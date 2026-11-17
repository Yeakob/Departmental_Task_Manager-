import Project from '../models/Project.js';
import ProjectMilestone from '../models/ProjectMilestone.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { ensureSameDept, sameId, includesId, targetDept } from '../utils/access.js';
import { notify } from '../services/notification.service.js';
import { emitToDepartment } from '../sockets/index.js';

const POP = [
  { path: 'manager', select: 'name email avatar designation' },
  { path: 'members', select: 'name email avatar designation' },
];

/** Effort-weighted progress across a set of tasks (estimatedHours, defaulting to 1). */
export async function computeProgress(match) {
  const [row] = await Task.aggregate([
    { $match: { ...match, isTemplate: false, status: { $nin: ['cancelled', 'draft'] } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        weight: { $sum: { $max: ['$estimatedHours', 1] } },
        done: { $sum: { $multiply: [{ $max: ['$estimatedHours', 1] }, { $divide: ['$progress', 100] }] } },
        overdue: {
          $sum: {
            $cond: [{ $and: [{ $lt: ['$deadline', new Date()] }, { $not: [{ $in: ['$status', ['completed', 'rejected', 'cancelled']] }] }] }, 1, 0],
          },
        },
      },
    },
  ]);
  if (!row) return { total: 0, completed: 0, overdue: 0, progress: 0 };
  return { total: row.total, completed: row.completed, overdue: row.overdue, progress: Math.round((row.done / row.weight) * 100) };
}

function canManage(req, project) {
  return hasPermission(req, 'project:update') || sameId(project.manager, req.user._id);
}

async function assertMembers(ids, department) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return;
  const n = await User.countDocuments({ _id: { $in: unique }, department, isActive: true });
  if (n !== unique.length) throw ApiError.badRequest('All members must be active users of this department');
}

export const list = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  if (!req.isSuperAdmin) filter.department = req.departmentId;
  if (q.status) filter.status = { $in: String(q.status).split(',') };
  else if (q.archived !== 'true') filter.status = { $ne: 'archived' };
  if (q.mine === 'true') filter.$or = [{ manager: req.user._id }, { members: req.user._id }];
  if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
  const pg = parsePagination(q, { defaultSort: '-createdAt' });
  const { items, meta } = await paginate(Project, filter, pg, POP);
  const withProgress = await Promise.all(items.map(async (p) => ({ ...p, stats: await computeProgress({ project: p._id }) })));
  ok(res, withProgress, meta);
});

export const getOne = asyncHandler(async (req, res) => {
  const project = ensureSameDept(req, await Project.findById(req.params.id).populate(POP).lean(), 'Project');
  const [milestones, stats, byStatus] = await Promise.all([
    ProjectMilestone.find({ project: project._id }).sort('order dueDate').lean(),
    computeProgress({ project: project._id }),
    Task.aggregate([{ $match: { project: project._id, isTemplate: false } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  ok(res, { ...project, milestones, stats, byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])) });
});

export const create = asyncHandler(async (req, res) => {
  const department = targetDept(req, req.body.department);
  await assertMembers([req.body.manager, ...(req.body.members || [])], department);
  const project = await Project.create({ ...req.body, department, createdBy: req.user._id });
  audit(req, { action: 'project.create', entityType: 'Project', entityId: project._id, after: { title: project.title } });
  await notify({
    recipients: [project.manager, ...project.members],
    actor: req.user._id,
    type: 'task_assigned',
    title: `Added to project: ${project.title}`,
    message: `${req.user.name} added you to the project "${project.title}".`,
    entityType: 'project',
    entityId: project._id,
    link: `/projects/${project._id}`,
  });
  emitToDepartment(department, 'project:changed', { id: String(project._id) });
  created(res, await project.populate(POP));
});

export const update = asyncHandler(async (req, res) => {
  const project = ensureSameDept(req, await Project.findById(req.params.id), 'Project');
  if (!canManage(req, project)) throw ApiError.forbidden('Only the project manager or authorized staff can edit this project');
  if (req.body.manager || req.body.members) await assertMembers([req.body.manager, ...(req.body.members || [])], project.department);
  const before = project.toObject();
  Object.assign(project, req.body);
  if (req.body.status === 'archived') project.archivedAt = new Date();
  if (req.body.status && req.body.status !== 'archived') project.archivedAt = null;
  await project.save();
  audit(req, { action: 'project.update', entityType: 'Project', entityId: project._id, before: { title: before.title, status: before.status }, after: req.body });
  emitToDepartment(project.department, 'project:changed', { id: String(project._id) });
  ok(res, await project.populate(POP));
});

export const remove = asyncHandler(async (req, res) => {
  const project = ensureSameDept(req, await Project.findById(req.params.id), 'Project');
  await project.softDelete(req.user._id);
  audit(req, { action: 'project.delete', entityType: 'Project', entityId: project._id });
  emitToDepartment(project.department, 'project:changed', { id: String(project._id) });
  ok(res, { deleted: true });
});

// ---------- milestones ----------
async function loadManaged(req) {
  const project = ensureSameDept(req, await Project.findById(req.params.id), 'Project');
  if (!canManage(req, project)) throw ApiError.forbidden('Only the project manager can manage milestones');
  return project;
}

export const addMilestone = asyncHandler(async (req, res) => {
  const project = await loadManaged(req);
  const count = await ProjectMilestone.countDocuments({ project: project._id });
  created(res, await ProjectMilestone.create({ ...req.body, project: project._id, order: count }));
});

export const updateMilestone = asyncHandler(async (req, res) => {
  const project = await loadManaged(req);
  const m = await ProjectMilestone.findOne({ _id: req.params.milestoneId, project: project._id });
  if (!m) throw ApiError.notFound('Milestone not found');
  Object.assign(m, req.body);
  if (req.body.status === 'completed' && !m.completedAt) m.completedAt = new Date();
  if (req.body.status && req.body.status !== 'completed') m.completedAt = null;
  await m.save();
  ok(res, m);
});

export const deleteMilestone = asyncHandler(async (req, res) => {
  const project = await loadManaged(req);
  await ProjectMilestone.deleteOne({ _id: req.params.milestoneId, project: project._id });
  await Task.updateMany({ milestone: req.params.milestoneId }, { $set: { milestone: null } });
  ok(res, { deleted: true });
});

/** Gantt data: project tasks with start/end and dependencies, plus milestones. */
export const timeline = asyncHandler(async (req, res) => {
  const project = ensureSameDept(req, await Project.findById(req.params.id).lean(), 'Project');
  const [tasks, milestones] = await Promise.all([
    Task.find({ project: project._id, isTemplate: false, status: { $ne: 'cancelled' } })
      .select('taskId title status priority startDate deadline createdAt progress dependsOn assignees milestone')
      .populate('assignees.user', 'name avatar')
      .sort('startDate deadline')
      .lean(),
    ProjectMilestone.find({ project: project._id }).sort('dueDate').lean(),
  ]);
  ok(res, { project, tasks, milestones });
});

export const isMember = (project, userId) => sameId(project.manager, userId) || includesId(project.members, userId);
