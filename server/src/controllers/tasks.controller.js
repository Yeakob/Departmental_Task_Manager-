import Task from '../models/Task.js';
import TaskComment from '../models/TaskComment.js';
import TaskChecklist from '../models/TaskChecklist.js';
import TaskAttachment from '../models/TaskAttachment.js';
import TaskActivity from '../models/TaskActivity.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { toPublicPath, removeFile } from '../middleware/upload.js';
import * as svc from '../services/task.service.js';
import * as approvalSvc from '../services/approval.service.js';
import { notify } from '../services/notification.service.js';
import { emitToTask, emitToDepartment } from '../sockets/index.js';
import { OPEN_STATUSES } from '../config/constants.js';

/** Builds the Mongo filter for list endpoints respecting department + permission scope. */
export function buildTaskFilter(req, q = {}) {
  const filter = {};
  const me = req.user._id;
  if (!req.isSuperAdmin) filter.department = req.departmentId;
  else if (q.department) filter.department = q.department;

  const canReadAll = hasPermission(req, 'task:read_all');
  const scope = q.scope || (canReadAll ? 'all' : 'mine');

  const mineClause = { $or: [{ 'assignees.user': me }, { supporters: me }, { assignedBy: me }, { watchers: me }, { approvers: me }] };

  switch (scope) {
    case 'mine':
      filter.$and = [{ $or: [{ 'assignees.user': me }, { supporters: me }] }];
      break;
    case 'created':
      filter.assignedBy = me;
      break;
    case 'watching':
      filter.watchers = me;
      break;
    case 'approvals':
      filter.status = 'under_review';
      if (!canReadAll || !hasPermission(req, 'task:approve')) filter.$and = [{ $or: [{ approvers: me }, { assignedBy: me }] }];
      else filter.$and = [{ $or: [{ approvers: me }, { approvers: { $size: 0 } }, { assignedBy: me }] }];
      break;
    case 'overdue':
      filter.status = { $in: OPEN_STATUSES };
      filter.deadline = { $lt: new Date() };
      if (!canReadAll) filter.$and = [mineClause];
      break;
    case 'upcoming': {
      const in7 = new Date(Date.now() + 7 * 86400000);
      filter.status = { $in: OPEN_STATUSES };
      filter.deadline = { $gte: new Date(), $lte: in7 };
      if (!canReadAll) filter.$and = [mineClause];
      break;
    }
    default:
      if (!canReadAll) filter.$and = [mineClause];
  }

  if (q.status?.length && !filter.status) filter.status = { $in: q.status };
  if (q.priority?.length) filter.priority = { $in: q.priority };
  if (q.category?.length) filter.category = { $in: q.category };
  if (q.tags?.length) filter.tags = { $in: q.tags };
  if (q.assignee) filter['assignees.user'] = q.assignee;
  if (q.assignedBy) filter.assignedBy = q.assignedBy;
  if (q.committee) filter.committee = q.committee;
  if (q.project) filter.project = q.project;
  if (q.parentTask) filter.parentTask = q.parentTask;
  else if (!q.q && !q.scope?.match(/mine|overdue|upcoming|approvals/)) filter.parentTask = filter.parentTask ?? null; // top-level only by default
  filter.isTemplate = q.isTemplate === 'true';
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.deadlineFrom || q.deadlineTo) filter.deadline = { ...(filter.deadline || {}), ...(q.deadlineFrom ? { $gte: q.deadlineFrom } : {}), ...(q.deadlineTo ? { $lte: q.deadlineTo } : {}) };
  if (q.overdue === 'true') { filter.status = { $in: OPEN_STATUSES }; filter.deadline = { ...(filter.deadline || {}), $lt: new Date() }; }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$and = [...(filter.$and || []), { $or: [{ title: rx }, { taskId: rx }, { description: rx }, { tags: rx }] }];
  }
  return filter;
}

export const list = asyncHandler(async (req, res) => {
  const filter = buildTaskFilter(req, req.query);
  const pg = parsePagination(req.query, { defaultSort: '-createdAt' });
  const result = await paginate(Task, filter, pg, svc.TASK_POPULATE);
  ok(res, result.items, result.meta);
});

export const kanban = asyncHandler(async (req, res) => {
  const filter = buildTaskFilter(req, { ...req.query, status: undefined, scope: req.query.scope });
  filter.status = { $in: ['assigned', 'acknowledged', 'in_progress', 'under_review', 'revision_required', 'completed'] };
  delete filter.parentTask;
  if (!req.query.showOld) {
    // hide completed tasks older than 30 days to keep the board light
    filter.$and = [...(filter.$and || []), { $or: [{ status: { $ne: 'completed' } }, { completedAt: { $gte: new Date(Date.now() - 30 * 86400000) } }] }];
  }
  const tasks = await Task.find(filter).sort('kanbanOrder -createdAt').limit(500).populate(svc.TASK_POPULATE).lean({ virtuals: true });
  ok(res, tasks);
});

export const getOne = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req, { lean: true });
  const [checklist, subtasks, attachmentCount, commentCount] = await Promise.all([
    TaskChecklist.findOne({ task: task._id }).lean({ virtuals: true }),
    Task.find({ parentTask: task._id }).select('taskId title status priority deadline progress assignees').populate('assignees.user', 'name avatar').lean({ virtuals: true }),
    TaskAttachment.countDocuments({ task: task._id }),
    TaskComment.countDocuments({ task: task._id }),
  ]);
  ok(res, { ...task, checklist, subtasks, attachmentCount, commentCount });
});

export const create = asyncHandler(async (req, res) => {
  const task = await svc.createTask(req, req.body);
  audit(req, { action: 'task.create', entityType: 'Task', entityId: task._id, after: { taskId: task.taskId, title: task.title } });
  created(res, task);
});

export const update = asyncHandler(async (req, res) => {
  const task = await svc.updateTask(req, req.params.id, req.body);
  audit(req, { action: 'task.update', entityType: 'Task', entityId: task._id, after: req.body });
  ok(res, task);
});

export const remove = asyncHandler(async (req, res) => {
  const task = await svc.deleteTask(req, req.params.id);
  audit(req, { action: 'task.delete', entityType: 'Task', entityId: task._id });
  ok(res, { deleted: true });
});

export const restore = asyncHandler(async (req, res) => ok(res, await svc.restoreTask(req, req.params.id)));

export const recycleBin = asyncHandler(async (req, res) => {
  if (!hasPermission(req, 'task:delete')) throw ApiError.forbidden();
  const filter = { deletedAt: { $ne: null }, ...(req.isSuperAdmin ? {} : { department: req.departmentId }) };
  const items = await Task.find(filter).setOptions({ withDeleted: true }).sort('-deletedAt').limit(200).populate('deletedBy', 'name').populate('assignees.user', 'name avatar').lean();
  ok(res, items);
});

export const changeStatus = asyncHandler(async (req, res) => {
  const task = await svc.changeStatus(req, req.params.id, req.body);
  audit(req, { action: 'task.status', entityType: 'Task', entityId: task._id, after: { status: req.body.status } });
  ok(res, task);
});

export const assign = asyncHandler(async (req, res) => {
  const task = await svc.assignTask(req, req.params.id, req.body);
  audit(req, { action: 'task.assign', entityType: 'Task', entityId: task._id, after: req.body });
  ok(res, task);
});

export const delegate = asyncHandler(async (req, res) => ok(res, await svc.delegateTask(req, req.params.id, req.body)));
export const progress = asyncHandler(async (req, res) => ok(res, await svc.updateProgress(req, req.params.id, req.body)));
export const requestExtension = asyncHandler(async (req, res) => ok(res, await svc.requestExtension(req, req.params.id, req.body)));
export const decideExtension = asyncHandler(async (req, res) => ok(res, await svc.decideExtension(req, req.params.id, req.params.requestId, req.body)));
export const watch = asyncHandler(async (req, res) => ok(res, await svc.setWatch(req, req.params.id, req.body.watch)));
export const addDependency = asyncHandler(async (req, res) => ok(res, await svc.addDependency(req, req.params.id, req.body.dependsOn)));
export const removeDependency = asyncHandler(async (req, res) => ok(res, await svc.removeDependency(req, req.params.id, req.params.depId)));
export const duplicate = asyncHandler(async (req, res) => created(res, await svc.duplicateTask(req, req.params.id)));
export const kanbanMove = asyncHandler(async (req, res) => ok(res, await svc.kanbanMove(req, req.params.id, req.body)));

// ---------- approvals ----------
export const submit = asyncHandler(async (req, res) => {
  const result = await approvalSvc.submitForApproval(req, req.params.id, req.body);
  audit(req, { action: 'task.submit', entityType: 'Task', entityId: result.task._id });
  ok(res, result);
});
export const approve = asyncHandler(async (req, res) => {
  const result = await approvalSvc.decideApproval(req, req.params.id, req.body);
  audit(req, { action: `task.${req.body.decision}`, entityType: 'Task', entityId: result.task._id, after: req.body });
  ok(res, result);
});
export const approvals = asyncHandler(async (req, res) => ok(res, await approvalSvc.approvalHistory(req, req.params.id)));

// ---------- activity ----------
export const activity = asyncHandler(async (req, res) => {
  await svc.loadTask(req.params.id, req, { lean: true });
  const items = await TaskActivity.find({ task: req.params.id }).sort('-createdAt').limit(200).populate('actor', 'name avatar').lean();
  ok(res, items);
});

// ---------- comments ----------
const MENTION_RX = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/g; // @[Name](userId)

export const listComments = asyncHandler(async (req, res) => {
  await svc.loadTask(req.params.id, req, { lean: true });
  const items = await TaskComment.find({ task: req.params.id }).sort('createdAt').populate('author', 'name avatar designation').populate('mentions', 'name').lean();
  ok(res, items);
});

export const addComment = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!hasPermission(req, 'task:comment')) throw ApiError.forbidden();
  const mentions = new Set((req.body.mentions || []).map(String));
  for (const m of req.body.body.matchAll(MENTION_RX)) mentions.add(m[2]);
  const validMentions = mentions.size ? (await User.find({ _id: { $in: [...mentions] }, department: task.department }).select('_id').lean()).map((u) => u._id) : [];

  const comment = await TaskComment.create({ task: task._id, author: req.user._id, body: req.body.body, parent: req.body.parent || null, mentions: validMentions });
  await comment.populate('author', 'name avatar designation');
  await svc.logActivity(task._id, req.user._id, 'commented', 'added a comment', { comment: comment._id });

  emitToTask(task._id, 'comment:new', comment.toJSON());
  const participants = svc.participantIds(task).filter((p) => !validMentions.map(String).includes(p));
  await notify({ recipients: participants, actor: req.user._id, type: 'comment', title: `New comment on ${task.taskId}`, message: `${req.user.name}: ${req.body.body.slice(0, 200)}`, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}`, email: false });
  await notify({ recipients: validMentions, actor: req.user._id, type: 'mention', title: `${req.user.name} mentioned you in ${task.taskId}`, message: req.body.body.slice(0, 200), entityType: 'task', entityId: task._id, link: `/tasks/${task._id}` });
  created(res, comment);
});

export const updateComment = asyncHandler(async (req, res) => {
  const comment = await TaskComment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound('Comment not found');
  if (String(comment.author) !== String(req.user._id)) throw ApiError.forbidden('You can only edit your own comments');
  comment.body = req.body.body;
  comment.editedAt = new Date();
  await comment.save();
  await comment.populate('author', 'name avatar');
  emitToTask(comment.task, 'comment:updated', comment.toJSON());
  ok(res, comment);
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await TaskComment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound('Comment not found');
  if (String(comment.author) !== String(req.user._id) && !hasPermission(req, 'task:update_any')) throw ApiError.forbidden();
  await comment.softDelete(req.user._id);
  emitToTask(comment.task, 'comment:deleted', { id: String(comment._id) });
  ok(res, { deleted: true });
});

// ---------- checklist ----------
async function getChecklist(taskId) {
  return TaskChecklist.findOneAndUpdate({ task: taskId }, { $setOnInsert: { task: taskId } }, { new: true, upsert: true });
}
async function emitChecklist(task, checklist, req) {
  const items = checklist.items.length;
  const done = checklist.items.filter((i) => i.done).length;
  // Auto-progress from checklist when the task is open
  if (items && OPEN_STATUSES.includes(task.status)) {
    task.progress = Math.round((done / items) * 100);
    if (task.progress > 0 && ['assigned', 'acknowledged'].includes(task.status)) task.status = 'in_progress';
    await task.save();
    emitToDepartment(task.department._id || task.department, 'task:updated', (await task.populate(svc.TASK_POPULATE)).toJSON());
  }
  emitToTask(task._id, 'checklist:updated', checklist.toJSON());
  await svc.logActivity(task._id, req.user._id, 'checklist_updated', `checklist ${done}/${items} complete`);
}

export const addChecklistItem = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!svc.canEdit(req, task)) throw ApiError.forbidden();
  const cl = await getChecklist(task._id);
  cl.items.push({ text: req.body.text, order: cl.items.length });
  await cl.save();
  await emitChecklist(task, cl, req);
  created(res, cl);
});

export const toggleChecklistItem = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!svc.canEdit(req, task)) throw ApiError.forbidden();
  const cl = await getChecklist(task._id);
  const item = cl.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound('Checklist item not found');
  item.done = req.body.done;
  item.doneBy = req.body.done ? req.user._id : undefined;
  item.doneAt = req.body.done ? new Date() : undefined;
  await cl.save();
  await emitChecklist(task, cl, req);
  ok(res, cl);
});

export const updateChecklistItem = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!svc.canEdit(req, task)) throw ApiError.forbidden();
  const cl = await getChecklist(task._id);
  const item = cl.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound('Checklist item not found');
  item.text = req.body.text;
  await cl.save();
  emitToTask(task._id, 'checklist:updated', cl.toJSON());
  ok(res, cl);
});

export const deleteChecklistItem = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!svc.canEdit(req, task)) throw ApiError.forbidden();
  const cl = await getChecklist(task._id);
  cl.items = cl.items.filter((i) => String(i._id) !== req.params.itemId);
  await cl.save();
  await emitChecklist(task, cl, req);
  ok(res, cl);
});

export const reorderChecklist = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!svc.canEdit(req, task)) throw ApiError.forbidden();
  const cl = await getChecklist(task._id);
  const orderMap = new Map(req.body.order.map((id, i) => [id, i]));
  for (const item of cl.items) item.order = orderMap.get(String(item._id)) ?? item.order;
  cl.items.sort((a, b) => a.order - b.order);
  await cl.save();
  emitToTask(task._id, 'checklist:updated', cl.toJSON());
  ok(res, cl);
});

// ---------- attachments ----------
export const listAttachments = asyncHandler(async (req, res) => {
  await svc.loadTask(req.params.id, req, { lean: true });
  ok(res, await TaskAttachment.find({ task: req.params.id }).sort('-createdAt').populate('uploadedBy', 'name avatar').lean());
});

export const uploadAttachments = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  if (!svc.isParticipant(task, req.user._id) && !hasPermission(req, 'task:update_any')) throw ApiError.forbidden();
  if (!req.files?.length) throw ApiError.badRequest('No files uploaded');
  const kind = req.body.kind === 'deliverable' ? 'deliverable' : 'attachment';
  const docs = await TaskAttachment.insertMany(
    req.files.map((f) => ({ task: task._id, uploadedBy: req.user._id, originalName: f.originalname, fileName: f.filename, path: toPublicPath(f.path), mimeType: f.mimetype, size: f.size, kind }))
  );
  await svc.logActivity(task._id, req.user._id, 'attachment_added', `uploaded ${docs.length} file(s)`, { files: docs.map((d) => d.originalName) });
  const populated = await TaskAttachment.find({ _id: { $in: docs.map((d) => d._id) } }).populate('uploadedBy', 'name avatar').lean();
  emitToTask(task._id, 'attachment:added', populated);
  created(res, populated);
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const task = await svc.loadTask(req.params.id, req);
  const att = await TaskAttachment.findOne({ _id: req.params.attachmentId, task: task._id });
  if (!att) throw ApiError.notFound('Attachment not found');
  if (String(att.uploadedBy) !== String(req.user._id) && !hasPermission(req, 'task:update_any')) throw ApiError.forbidden();
  if (att.approval) throw ApiError.badRequest('Deliverables attached to a submission cannot be removed');
  await att.softDelete(req.user._id);
  removeFile(att.path);
  await svc.logActivity(task._id, req.user._id, 'attachment_removed', `removed ${att.originalName}`);
  emitToTask(task._id, 'attachment:removed', { id: String(att._id) });
  ok(res, { deleted: true });
});

// ---------- bulk ----------
export const bulkCreate = asyncHandler(async (req, res) => {
  const results = [];
  for (const t of req.body.tasks) results.push(await svc.createTask(req, t));
  audit(req, { action: 'task.bulk_create', entityType: 'Task', meta: { count: results.length } });
  created(res, results);
});

export const bulkAssign = asyncHandler(async (req, res) => {
  const results = [];
  for (const id of req.body.taskIds) results.push(await svc.assignTask(req, id, { assignees: req.body.assignees, mode: req.body.mode || 'add' }));
  audit(req, { action: 'task.bulk_assign', entityType: 'Task', meta: { count: results.length } });
  ok(res, results);
});

export const bulkStatus = asyncHandler(async (req, res) => {
  const results = [];
  const errors = [];
  for (const id of req.body.taskIds) {
    try { results.push(await svc.changeStatus(req, id, { status: req.body.status })); } catch (e) { errors.push({ id, message: e.message }); }
  }
  ok(res, { updated: results.length, errors });
});

// ---------- templates ----------
export const createFromTemplate = asyncHandler(async (req, res) => {
  const tpl = await svc.loadTask(req.params.id, req, { lean: true });
  if (!tpl.isTemplate) throw ApiError.badRequest('Not a template');
  const checklist = await TaskChecklist.findOne({ task: tpl._id }).lean();
  const task = await svc.createTask(req, {
    title: req.body.title || tpl.title,
    description: tpl.description,
    category: tpl.category?._id,
    priority: tpl.priority,
    estimatedHours: tpl.estimatedHours,
    requiresApproval: tpl.requiresApproval,
    committee: tpl.committee?._id,
    project: tpl.project?._id,
    tags: tpl.tags,
    customFields: tpl.customFields,
    checklist: checklist?.items?.map((i) => i.text),
    assignees: req.body.assignees || [],
    deadline: req.body.deadline,
    startDate: req.body.startDate,
    status: req.body.assignees?.length ? 'assigned' : 'draft',
  });
  created(res, task);
});
