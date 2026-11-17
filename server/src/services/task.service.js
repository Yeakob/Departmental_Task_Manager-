import Task from '../models/Task.js';
import TaskActivity from '../models/TaskActivity.js';
import TaskChecklist from '../models/TaskChecklist.js';
import Department from '../models/Department.js';
import Committee from '../models/Committee.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { nextSequence } from '../utils/taskId.js';
import { STATUS_TRANSITIONS, OPEN_STATUSES } from '../config/constants.js';
import { notify } from './notification.service.js';
import { emitToDepartment, emitToTask, emitToUsers } from '../sockets/index.js';
import { hasPermission } from '../middleware/auth.js';
import { withTransaction } from '../config/db.js';

export const TASK_POPULATE = [
  { path: 'assignees.user', select: 'name email avatar designation' },
  { path: 'assignedBy', select: 'name email avatar' },
  { path: 'supporters', select: 'name email avatar' },
  { path: 'approvers', select: 'name email avatar' },
  { path: 'watchers', select: 'name avatar' },
  { path: 'category', select: 'name color slug' },
  { path: 'committee', select: 'name' },
  { path: 'project', select: 'title status' },
  { path: 'parentTask', select: 'taskId title status' },
  { path: 'dependsOn', select: 'taskId title status' },
];

// ---------- helpers ----------
export function isAssignee(task, userId) {
  return (task.assignees || []).some((a) => String(a.user?._id || a.user) === String(userId));
}
export function isSupporter(task, userId) {
  return (task.supporters || []).some((u) => String(u?._id || u) === String(userId));
}
export function isParticipant(task, userId) {
  const id = String(userId);
  return (
    isAssignee(task, id) ||
    isSupporter(task, id) ||
    String(task.assignedBy?._id || task.assignedBy) === id ||
    String(task.createdBy?._id || task.createdBy) === id ||
    (task.watchers || []).some((u) => String(u?._id || u) === id) ||
    (task.approvers || []).some((u) => String(u?._id || u) === id)
  );
}

export function participantIds(task) {
  const ids = new Set();
  for (const a of task.assignees || []) ids.add(String(a.user?._id || a.user));
  for (const u of task.supporters || []) ids.add(String(u?._id || u));
  for (const u of task.watchers || []) ids.add(String(u?._id || u));
  ids.add(String(task.assignedBy?._id || task.assignedBy));
  return [...ids];
}

/** Can this request view the task? */
export function canView(req, task) {
  if (req.isSuperAdmin) return true;
  if (String(task.department?._id || task.department) !== req.departmentId) return false;
  if (hasPermission(req, 'task:read_all')) return true;
  return isParticipant(task, req.user._id);
}

/** Can this request edit general task fields? */
export function canEdit(req, task) {
  if (req.isSuperAdmin) return true;
  if (String(task.department?._id || task.department) !== req.departmentId) return false;
  if (hasPermission(req, 'task:update_any')) return true;
  if (String(task.assignedBy?._id || task.assignedBy) === String(req.user._id)) return true;
  return hasPermission(req, 'task:update_own') && isAssignee(task, req.user._id);
}

export function canApprove(req, task) {
  if (req.isSuperAdmin) return true;
  if (String(task.department?._id || task.department) !== req.departmentId) return false;
  if (task.approvers?.length && task.approvers.some((u) => String(u?._id || u) === String(req.user._id))) return true;
  return hasPermission(req, 'task:approve') && !isAssignee(task, req.user._id);
}

export async function logActivity(taskId, actor, type, message, meta, session = null) {
  const [doc] = await TaskActivity.create([{ task: taskId, actor, type, message, meta }], { session });
  emitToTask(taskId, 'task:activity', doc.toJSON());
  return doc;
}

export async function loadTask(id, req, { lean = false } = {}) {
  let q = Task.findById(id).populate(TASK_POPULATE);
  if (lean) q = q.lean({ virtuals: true });
  const task = await q;
  if (!task) throw ApiError.notFound('Task not found');
  if (!canView(req, task)) throw ApiError.forbidden('You cannot access this task');
  return task;
}

function broadcast(task, event = 'task:updated') {
  const payload = typeof task.toJSON === 'function' ? task.toJSON() : task;
  emitToDepartment(task.department?._id || task.department, event, payload);
  emitToTask(task._id, event, payload);
}

async function validateRefs(data, departmentId) {
  if (data.committee) {
    const c = await Committee.findOne({ _id: data.committee, department: departmentId }).select('_id');
    if (!c) throw ApiError.badRequest('Committee not found in your department');
  }
  if (data.project) {
    const p = await Project.findOne({ _id: data.project, department: departmentId }).select('_id');
    if (!p) throw ApiError.badRequest('Project not found in your department');
  }
  const userIds = [...(data.assignees || []).map((a) => a.user), ...(data.supporters || []), ...(data.approvers || []), ...(data.watchers || [])].filter(Boolean);
  if (userIds.length) {
    const count = await User.countDocuments({ _id: { $in: userIds }, department: departmentId, isActive: true });
    if (count !== new Set(userIds.map(String)).size) throw ApiError.badRequest('One or more users are not active members of this department');
  }
  if (data.parentTask) {
    const parent = await Task.findOne({ _id: data.parentTask, department: departmentId }).select('_id parentTask');
    if (!parent) throw ApiError.badRequest('Parent task not found');
    if (parent.parentTask) throw ApiError.badRequest('Subtasks cannot be nested more than one level');
  }
}

function normalizeAssignees(list = []) {
  const seen = new Set();
  const out = [];
  for (const a of list) {
    const id = String(a.user);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ user: a.user, isPrimary: Boolean(a.isPrimary), responsibility: a.responsibility });
  }
  if (out.length && !out.some((a) => a.isPrimary)) out[0].isPrimary = true;
  return out;
}

// ---------- create ----------
export async function createTask(req, data) {
  const departmentId = req.isSuperAdmin && data.department ? data.department : req.departmentId;
  if (!departmentId) throw ApiError.badRequest('You are not attached to a department');

  const canAssignOthers = hasPermission(req, 'task:assign');
  let assignees = normalizeAssignees(data.assignees);
  const isPersonal = data.isPersonal || (!canAssignOthers && (!assignees.length || assignees.every((a) => String(a.user) === String(req.user._id))));

  if (!canAssignOthers) {
    // Users without assign permission may only create personal tasks for themselves.
    if (assignees.some((a) => String(a.user) !== String(req.user._id))) throw ApiError.forbidden('You cannot assign tasks to other users');
    if (data.supporters?.length) throw ApiError.forbidden('You cannot add supporters');
    assignees = [{ user: req.user._id, isPrimary: true }];
  }

  await validateRefs({ ...data, assignees }, departmentId);
  const dept = await Department.findById(departmentId).select('code settings').lean();
  const prefix = dept?.settings?.taskIdPrefix || dept?.code || 'TASK';

  const result = await withTransaction(async (session) => {
    const taskId = await nextSequence(`task:${departmentId}`, prefix, session);
    const status = data.isTemplate ? 'draft' : data.status || (assignees.length ? 'assigned' : 'draft');
    const [task] = await Task.create(
      [
        {
          ...data,
          taskId,
          department: departmentId,
          assignedBy: req.user._id,
          createdBy: req.user._id,
          assignees,
          status,
          isPersonal,
          requiresApproval: isPersonal ? false : data.requiresApproval ?? true,
          watchers: [...new Set([...(data.watchers || []).map(String), String(req.user._id)])],
          assignmentHistory: assignees.length ? [{ action: 'assigned', by: req.user._id, to: assignees.map((a) => a.user) }] : [],
        },
      ],
      { session }
    );
    if (data.checklist?.length) {
      await TaskChecklist.create([{ task: task._id, items: data.checklist.map((text, i) => ({ text, order: i })) }], { session });
    }
    await logActivity(task._id, req.user._id, 'created', `created task ${taskId}`, null, session);
    if (data.parentTask) await logActivity(data.parentTask, req.user._id, 'subtask_added', `added subtask ${taskId}`, { subtask: task._id }, session);
    return task;
  });

  const task = await Task.findById(result._id).populate(TASK_POPULATE);
  if (task.status === 'assigned' && !isPersonal) {
    await notify({
      recipients: [...assignees.map((a) => a.user), ...(data.supporters || [])],
      actor: req.user._id,
      type: 'task_assigned',
      title: `New task assigned: ${task.title}`,
      message: `${req.user.name} assigned you "${task.title}" (${task.taskId})${task.deadline ? `, due ${task.deadline.toDateString()}` : ''}.`,
      entityType: 'task',
      entityId: task._id,
      link: `/tasks/${task._id}`,
    });
  }
  broadcast(task, 'task:created');
  return task;
}

// ---------- update ----------
export async function updateTask(req, id, data) {
  const task = await loadTask(id, req);
  if (!canEdit(req, task)) throw ApiError.forbidden('You cannot edit this task');

  const restricted = ['supporters', 'committee', 'project', 'deadline', 'requiresApproval', 'approvers', 'priority', 'estimatedHours', 'category', 'dependsOn', 'parentTask', 'milestone'];
  const isManager = hasPermission(req, 'task:update_any') || String(task.assignedBy._id) === String(req.user._id);
  if (!isManager) for (const k of restricted) if (k in data) throw ApiError.forbidden(`Only the task owner can change ${k}`);

  await validateRefs(data, task.department);
  const before = { title: task.title, deadline: task.deadline, priority: task.priority, progress: task.progress };
  Object.assign(task, data, { updatedBy: req.user._id });
  if (data.progress === 100 && OPEN_STATUSES.includes(task.status) && !task.requiresApproval) {
    task.status = 'completed';
    task.completedAt = new Date();
  }
  await task.save();
  await logActivity(task._id, req.user._id, 'updated', 'updated task details', { before, after: data });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

// ---------- status workflow ----------
export async function changeStatus(req, id, { status, note, progress }) {
  const task = await loadTask(id, req);
  const from = task.status;
  if (from === status) return task;

  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(status)) throw ApiError.badRequest(`Cannot move task from "${from}" to "${status}"`);

  const assignee = isAssignee(task, req.user._id);
  const manager = hasPermission(req, 'task:update_any') || String(task.assignedBy._id) === String(req.user._id);
  const approver = canApprove(req, task);

  // Permission rules per transition
  if (['completed', 'revision_required', 'rejected'].includes(status) && from === 'under_review' && !approver) throw ApiError.forbidden('Only an authorized reviewer can decide a submission');
  if (status === 'under_review' && !(assignee || manager)) throw ApiError.forbidden('Only an assignee can submit for review');
  if (status === 'completed' && from !== 'under_review') {
    if (task.requiresApproval && !manager) throw ApiError.forbidden('This task requires approval; submit it for review instead');
    if (!(assignee || manager)) throw ApiError.forbidden();
  }
  if (['cancelled', 'on_hold', 'assigned'].includes(status) && !manager) throw ApiError.forbidden('Only the task owner can do this');
  if (['acknowledged', 'in_progress'].includes(status) && !(assignee || manager)) throw ApiError.forbidden();

  // Dependencies must be complete before starting
  if (status === 'in_progress' && task.dependsOn?.length) {
    const blocked = task.dependsOn.filter((d) => d.status !== 'completed');
    if (blocked.length) throw ApiError.badRequest(`Blocked by: ${blocked.map((b) => b.taskId).join(', ')}`);
  }

  task.status = status;
  if (progress != null) task.progress = progress;
  if (status === 'acknowledged') for (const a of task.assignees) if (String(a.user._id) === String(req.user._id)) a.acknowledgedAt = new Date();
  if (status === 'completed') { task.completedAt = new Date(); task.progress = 100; }
  if (status === 'under_review') task.submittedAt = new Date();
  if (['in_progress', 'assigned'].includes(status) && from === 'completed') task.completedAt = null;
  task.updatedBy = req.user._id;
  await task.save();

  await logActivity(task._id, req.user._id, 'status_changed', `changed status from ${from} to ${status}${note ? `: ${note}` : ''}`, { from, to: status, note });

  const recipients = participantIds(task);
  await notify({
    recipients,
    actor: req.user._id,
    type: status === 'completed' ? 'task_completed' : 'status_changed',
    title: `${task.taskId}: ${status.replace('_', ' ')}`,
    message: `${req.user.name} moved "${task.title}" to ${status.replace('_', ' ')}.${note ? ` Note: ${note}` : ''}`,
    entityType: 'task',
    entityId: task._id,
    link: `/tasks/${task._id}`,
    email: ['completed', 'rejected', 'revision_required'].includes(status),
  });

  // Unblock dependents when completed
  if (status === 'completed') {
    const dependents = await Task.find({ dependsOn: task._id, status: { $in: OPEN_STATUSES } }).select('_id assignees title taskId').lean();
    for (const d of dependents) {
      await notify({
        recipients: d.assignees.map((a) => a.user),
        type: 'status_changed',
        title: `Dependency completed for ${d.taskId}`,
        message: `"${task.title}" is complete; "${d.title}" is no longer blocked.`,
        entityType: 'task',
        entityId: d._id,
        link: `/tasks/${d._id}`,
        email: false,
      });
    }
  }

  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

// ---------- assignment / delegation ----------
export async function assignTask(req, id, { assignees, mode = 'replace', note, deadline }) {
  const task = await loadTask(id, req);
  const manager = hasPermission(req, 'task:assign') && (hasPermission(req, 'task:update_any') || String(task.assignedBy._id) === String(req.user._id));
  if (!manager) throw ApiError.forbidden('You cannot assign this task');
  await validateRefs({ assignees }, task.department);

  const previous = task.assignees.map((a) => a.user._id);
  let next = normalizeAssignees(assignees);
  if (mode === 'add') {
    const existing = task.assignees.map((a) => ({ user: a.user._id, isPrimary: a.isPrimary, responsibility: a.responsibility, acknowledgedAt: a.acknowledgedAt }));
    next = normalizeAssignees([...existing, ...next.map((a) => ({ ...a, isPrimary: false }))]);
  }
  task.assignees = next;
  if (deadline) task.deadline = deadline;
  if (task.status === 'draft') task.status = 'assigned';
  task.assignmentHistory.push({ action: previous.length ? 'reassigned' : 'assigned', by: req.user._id, from: previous, to: next.map((a) => a.user), note });
  task.updatedBy = req.user._id;
  await task.save();

  const newIds = next.map((a) => String(a.user)).filter((u) => !previous.map(String).includes(u));
  await logActivity(task._id, req.user._id, previous.length ? 'reassigned' : 'assigned', `${previous.length ? 'reassigned' : 'assigned'} task${note ? `: ${note}` : ''}`, { from: previous, to: next.map((a) => a.user) });
  await notify({
    recipients: newIds,
    actor: req.user._id,
    type: previous.length ? 'task_reassigned' : 'task_assigned',
    title: `Task assigned: ${task.title}`,
    message: `${req.user.name} assigned you "${task.title}" (${task.taskId}).${note ? ` ${note}` : ''}`,
    entityType: 'task',
    entityId: task._id,
    link: `/tasks/${task._id}`,
  });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

/** An assignee delegates their responsibility to another user (requires task:assign or being primary with permission). */
export async function delegateTask(req, id, { to, note }) {
  const task = await loadTask(id, req);
  if (!isAssignee(task, req.user._id)) throw ApiError.forbidden('Only an assignee can delegate');
  if (!hasPermission(req, 'task:assign')) throw ApiError.forbidden('You do not have delegation permission');
  await validateRefs({ assignees: [{ user: to }] }, task.department);

  const me = String(req.user._id);
  task.assignees = task.assignees.map((a) => (String(a.user._id) === me ? { user: to, isPrimary: a.isPrimary, responsibility: a.responsibility } : { user: a.user._id, isPrimary: a.isPrimary, responsibility: a.responsibility, acknowledgedAt: a.acknowledgedAt }));
  task.assignmentHistory.push({ action: 'delegated', by: req.user._id, from: [req.user._id], to: [to], note });
  if (!task.watchers.some((w) => String(w._id || w) === me)) task.watchers.push(req.user._id);
  await task.save();
  await logActivity(task._id, req.user._id, 'delegated', `delegated the task${note ? `: ${note}` : ''}`, { to });
  await notify({ recipients: [to, task.assignedBy._id], actor: req.user._id, type: 'task_reassigned', title: `Task delegated: ${task.title}`, message: `${req.user.name} delegated "${task.title}" (${task.taskId}).${note ? ` ${note}` : ''}`, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}` });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

// ---------- progress ----------
export async function updateProgress(req, id, { progress, actualHours }) {
  const task = await loadTask(id, req);
  if (!canEdit(req, task)) throw ApiError.forbidden();
  task.progress = progress;
  if (actualHours != null) task.actualHours = actualHours;
  if (progress > 0 && ['assigned', 'acknowledged'].includes(task.status)) task.status = 'in_progress';
  task.updatedBy = req.user._id;
  await task.save();
  await logActivity(task._id, req.user._id, 'progress_updated', `updated progress to ${progress}%`, { progress, actualHours });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

// ---------- extension requests ----------
export async function requestExtension(req, id, { requestedDeadline, reason }) {
  const task = await loadTask(id, req);
  if (!isAssignee(task, req.user._id)) throw ApiError.forbidden('Only an assignee can request an extension');
  if (task.extensionRequests.some((e) => e.status === 'pending')) throw ApiError.conflict('An extension request is already pending');
  if (task.deadline && requestedDeadline <= task.deadline) throw ApiError.badRequest('Requested deadline must be after the current deadline');
  task.extensionRequests.push({ requestedBy: req.user._id, requestedDeadline, reason });
  await task.save();
  await logActivity(task._id, req.user._id, 'extension_requested', `requested extension to ${requestedDeadline.toDateString()}`, { requestedDeadline, reason });
  const deciders = task.approvers?.length ? task.approvers.map((a) => a._id) : [task.assignedBy._id];
  await notify({ recipients: deciders, actor: req.user._id, type: 'extension_requested', title: `Extension requested: ${task.taskId}`, message: `${req.user.name} requested a deadline extension to ${requestedDeadline.toDateString()} for "${task.title}". Reason: ${reason}`, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}` });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

export async function decideExtension(req, id, requestId, { decision, note }) {
  const task = await loadTask(id, req);
  const manager = hasPermission(req, 'task:extension_decide') || String(task.assignedBy._id) === String(req.user._id);
  if (!manager) throw ApiError.forbidden();
  const reqDoc = task.extensionRequests.id(requestId);
  if (!reqDoc || reqDoc.status !== 'pending') throw ApiError.notFound('Pending extension request not found');
  reqDoc.status = decision;
  reqDoc.decidedBy = req.user._id;
  reqDoc.decidedAt = new Date();
  reqDoc.decisionNote = note;
  if (decision === 'approved') {
    task.deadline = reqDoc.requestedDeadline;
    task.lastReminderOffset = null;
    task.overdueNotifiedAt = null;
  }
  await task.save();
  await logActivity(task._id, req.user._id, 'extension_decided', `${decision} extension request${note ? `: ${note}` : ''}`, { decision, requestId });
  await notify({ recipients: [reqDoc.requestedBy], actor: req.user._id, type: 'extension_decided', title: `Extension ${decision}: ${task.taskId}`, message: `${req.user.name} ${decision} your extension request for "${task.title}".${note ? ` ${note}` : ''}`, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}` });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

// ---------- watchers / dependencies ----------
export async function setWatch(req, id, watch) {
  const task = await loadTask(id, req);
  const me = String(req.user._id);
  const has = task.watchers.some((w) => String(w._id || w) === me);
  if (watch && !has) task.watchers.push(req.user._id);
  if (!watch && has) task.watchers = task.watchers.filter((w) => String(w._id || w) !== me);
  await task.save();
  if (watch && !has) await logActivity(task._id, req.user._id, 'watcher_added', 'started watching');
  await task.populate(TASK_POPULATE);
  return task;
}

export async function addDependency(req, id, dependsOn) {
  const task = await loadTask(id, req);
  if (!canEdit(req, task)) throw ApiError.forbidden();
  if (String(dependsOn) === String(task._id)) throw ApiError.badRequest('A task cannot depend on itself');
  const dep = await Task.findOne({ _id: dependsOn, department: task.department }).select('_id dependsOn taskId');
  if (!dep) throw ApiError.notFound('Dependency task not found');
  // simple cycle check (depth-limited)
  const visited = new Set();
  const stack = [dep._id];
  while (stack.length) {
    const cur = stack.pop();
    if (String(cur) === String(task._id)) throw ApiError.badRequest('Adding this dependency would create a cycle');
    if (visited.has(String(cur)) || visited.size > 200) continue;
    visited.add(String(cur));
    const t = await Task.findById(cur).select('dependsOn').lean();
    for (const d of t?.dependsOn || []) stack.push(d);
  }
  if (!task.dependsOn.some((d) => String(d._id || d) === String(dependsOn))) task.dependsOn.push(dependsOn);
  await task.save();
  await logActivity(task._id, req.user._id, 'dependency_added', `added dependency on ${dep.taskId}`, { dependsOn });
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

export async function removeDependency(req, id, depId) {
  const task = await loadTask(id, req);
  if (!canEdit(req, task)) throw ApiError.forbidden();
  task.dependsOn = task.dependsOn.filter((d) => String(d._id || d) !== String(depId));
  await task.save();
  await task.populate(TASK_POPULATE);
  broadcast(task);
  return task;
}

// ---------- duplicate / delete / restore ----------
export async function duplicateTask(req, id) {
  const src = await loadTask(id, req, { lean: true });
  if (!hasPermission(req, 'task:create')) throw ApiError.forbidden();
  const checklist = await TaskChecklist.findOne({ task: src._id }).lean();
  return createTask(req, {
    title: `${src.title} (copy)`,
    description: src.description,
    category: src.category?._id,
    assignees: hasPermission(req, 'task:assign') ? src.assignees.map((a) => ({ user: a.user._id, isPrimary: a.isPrimary, responsibility: a.responsibility })) : [],
    supporters: hasPermission(req, 'task:assign') ? src.supporters.map((s) => s._id) : [],
    committee: src.committee?._id,
    project: src.project?._id,
    priority: src.priority,
    estimatedHours: src.estimatedHours,
    requiresApproval: src.requiresApproval,
    approvers: src.approvers?.map((a) => a._id),
    tags: src.tags,
    customFields: src.customFields,
    checklist: checklist?.items?.map((i) => i.text),
    status: 'draft',
  });
}

export async function deleteTask(req, id) {
  const task = await loadTask(id, req);
  const owner = String(task.assignedBy._id) === String(req.user._id) || String(task.createdBy) === String(req.user._id);
  if (!(hasPermission(req, 'task:delete') || (owner && (task.isPersonal || task.status === 'draft')))) throw ApiError.forbidden('You cannot delete this task');
  await task.softDelete(req.user._id);
  await logActivity(task._id, req.user._id, 'deleted', 'moved task to recycle bin');
  emitToDepartment(task.department, 'task:deleted', { id: String(task._id) });
  emitToUsers(participantIds(task), 'task:deleted', { id: String(task._id) });
  return task;
}

export async function restoreTask(req, id) {
  const task = await Task.findById(id).setOptions({ withDeleted: true }).populate(TASK_POPULATE);
  if (!task || !task.deletedAt) throw ApiError.notFound('Deleted task not found');
  if (!canView(req, task) || !hasPermission(req, 'task:delete')) throw ApiError.forbidden();
  await task.restore();
  await logActivity(task._id, req.user._id, 'restored', 'restored task from recycle bin');
  broadcast(task, 'task:created');
  return task;
}

// ---------- kanban ----------
export async function kanbanMove(req, id, { status, orderedIds }) {
  const task = await changeStatus(req, id, { status });
  if (orderedIds?.length) {
    const ops = orderedIds.map((tid, i) => ({ updateOne: { filter: { _id: tid, department: task.department._id || task.department }, update: { kanbanOrder: i } } }));
    await Task.bulkWrite(ops);
    emitToDepartment(task.department._id || task.department, 'kanban:reordered', { status, orderedIds });
  }
  return task;
}
