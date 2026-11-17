import Task from '../models/Task.js';
import TaskActivity from '../models/TaskActivity.js';
import Meeting from '../models/Meeting.js';
import Announcement from '../models/Announcement.js';
import Committee from '../models/Committee.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { buildTaskFilter } from './tasks.controller.js';
import { computeProgress } from './projects.controller.js';
import * as R from '../services/report.service.js';
import { OPEN_STATUSES } from '../config/constants.js';

const LIST_POP = [{ path: 'assignees.user', select: 'name avatar' }, { path: 'category', select: 'name color' }];
const LIST_FIELDS = 'taskId title status priority deadline progress assignees category createdAt completedAt';

/** Base scope for analytics, applying the dashboard's interactive filters. */
function scopedMatch(req, extra = {}) {
  const q = req.query;
  const filter = buildTaskFilter(req, {
    scope: q.scope === 'mine' ? 'mine' : 'all',
    priority: q.priority ? String(q.priority).split(',') : undefined,
    category: q.category ? String(q.category).split(',') : undefined,
    assignee: q.assignee,
    committee: q.committee,
    project: q.project,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  });
  delete filter.parentTask; // analytics include subtasks
  if (q.status) filter.status = { $in: String(q.status).split(',') };
  else filter.status = { $ne: 'draft' };
  return R.castFilter({ ...filter, ...extra });
}

export const dashboard = asyncHandler(async (req, res) => {
  const match = scopedMatch(req);
  const me = req.user._id;
  const now = new Date();
  const seesAll = hasPermission(req, 'task:read_all');
  const deptFilter = req.isSuperAdmin ? {} : { department: req.departmentId };

  const myCommittees = await Committee.find({ 'members.user': me }).distinct('_id');
  const meetingFilter = { ...deptFilter, startAt: { $gte: now }, status: 'scheduled', ...(seesAll ? {} : { $or: [{ organizer: me }, { 'participants.user': me }, { committee: { $in: myCommittees } }] }) };
  const approvalFilter = buildTaskFilter(req, { scope: 'approvals' });
  delete approvalFilter.parentTask;

  const visibleTaskIds = await Task.find(match).select('_id').sort('-updatedAt').limit(500).lean();

  const [cards, byStatus, byPriority, byCategory, weekly, monthly, workload, myTasks, recent, upcoming, overdue, awaiting, activities, meetings, announcements] = await Promise.all([
    R.statusCounts(match),
    R.groupCount(match, 'status'),
    R.groupCount(match, 'priority'),
    R.byCategory(match),
    R.weeklyTrend(match, 8),
    R.monthlyTrend(match, 6),
    seesAll ? R.facultyMetrics(R.castFilter({ ...match, status: { $in: [...OPEN_STATUSES, 'completed'] } })) : Promise.resolve([]),
    Task.find({ 'assignees.user': me, status: { $in: OPEN_STATUSES }, isTemplate: false }).select(LIST_FIELDS).populate(LIST_POP).sort({ deadline: 1 }).limit(8).lean(),
    Task.find(match).select(LIST_FIELDS).populate(LIST_POP).sort('-createdAt').limit(8).lean(),
    Task.find({ ...match, status: { $in: OPEN_STATUSES }, deadline: { $gte: now, $lte: new Date(+now + 14 * 86400000) } }).select(LIST_FIELDS).populate(LIST_POP).sort('deadline').limit(8).lean(),
    Task.find({ ...match, status: { $in: OPEN_STATUSES }, deadline: { $lt: now } }).select(LIST_FIELDS).populate(LIST_POP).sort('deadline').limit(8).lean(),
    Task.find(approvalFilter).select(LIST_FIELDS + ' submittedAt').populate(LIST_POP).sort('submittedAt').limit(8).lean(),
    TaskActivity.find({ task: { $in: visibleTaskIds.map((t) => t._id) } }).sort('-createdAt').limit(12).populate('actor', 'name avatar').populate('task', 'taskId title').lean(),
    Meeting.find(meetingFilter).select('title startAt endAt location committee').populate('committee', 'name').sort('startAt').limit(5).lean(),
    Announcement.find({ department: { $in: [req.departmentId, null] }, publishAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).select('title priority isPinned publishAt author').populate('author', 'name').sort('-isPinned -publishAt').limit(5).lean(),
  ]);

  ok(res, {
    scope: seesAll && req.query.scope !== 'mine' ? 'department' : 'personal',
    cards,
    charts: { byStatus, byPriority, byCategory, weekly, monthly, workload: workload.slice(0, 12) },
    lists: { myTasks, recent, upcoming, overdue, awaitingApproval: awaiting, activities, meetings, announcements },
  });
});

export const faculty = asyncHandler(async (req, res) => {
  const canAll = hasPermission(req, 'report:faculty');
  let userIds = req.query.user ? String(req.query.user).split(',') : null;
  if (!canAll) {
    if (!hasPermission(req, 'report:self')) throw ApiError.forbidden();
    userIds = [String(req.user._id)];
  }
  const base = buildTaskFilter(req, { scope: 'all', from: req.query.from ? new Date(req.query.from) : undefined, to: req.query.to ? new Date(req.query.to) : undefined });
  delete base.parentTask;
  delete base.$and; // permission handled above; metrics are per-assignee
  base.status = { $nin: ['draft', 'cancelled'] };
  if (!userIds) userIds = (await User.find({ ...(req.isSuperAdmin ? {} : { department: req.departmentId }), isActive: true }).distinct('_id')).map(String);
  const rows = await R.facultyMetrics(R.castFilter(base), { userIds });

  let detail = null;
  if (userIds.length === 1) {
    const m = R.castFilter({ ...base, 'assignees.user': userIds[0] });
    const [monthly, byCategory, byPriority, open] = await Promise.all([
      R.monthlyTrend(m, 12),
      R.byCategory(m),
      R.groupCount(m, 'priority'),
      Task.find({ ...m, status: { $in: OPEN_STATUSES } }).select(LIST_FIELDS + ' estimatedHours').populate(LIST_POP).sort('deadline').limit(50).lean(),
    ]);
    detail = { monthly, byCategory, byPriority, open };
  }
  ok(res, { rows, detail, methodology: METHODOLOGY });
});

export const department = asyncHandler(async (req, res) => {
  const match = scopedMatch(req);
  const dept = req.isSuperAdmin ? {} : { department: req.departmentId };
  const [cards, monthly, byCategory, byPriority, overdue, committees, projects] = await Promise.all([
    R.statusCounts(match),
    R.monthlyTrend(match, 12),
    R.byCategory(match),
    R.groupCount(match, 'priority'),
    R.overdueAnalysis(match),
    Committee.find({ ...dept, isActive: true }).select('name coordinator members').populate('coordinator', 'name').lean(),
    Project.find({ ...dept, status: { $ne: 'archived' } }).select('title status startDate endDate manager').populate('manager', 'name').lean(),
  ]);
  const taskIds = (await Task.find(match).select('_id').lean()).map((t) => t._id);
  const [committeePerf, projectProgress, approvals, effort] = await Promise.all([
    Promise.all(committees.map(async (c) => ({ id: c._id, name: c.name, coordinator: c.coordinator?.name, members: c.members.length, ...(await computeProgress({ committee: c._id })) }))),
    Promise.all(projects.map(async (p) => ({ id: p._id, title: p.title, status: p.status, manager: p.manager?.name, endDate: p.endDate, ...(await computeProgress({ project: p._id })) }))),
    R.approvalStats(taskIds),
    Task.aggregate([{ $match: match }, { $group: { _id: null, assigned: { $sum: R.effortExpr }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, R.effortExpr, 0] } } } }]),
  ]);
  ok(res, {
    cards,
    effort: { assigned: Math.round(effort[0]?.assigned || 0), completed: Math.round(effort[0]?.completed || 0) },
    monthly,
    byCategory,
    byPriority,
    overdue,
    committees: committeePerf,
    projects: projectProgress,
    approvals,
    methodology: METHODOLOGY,
  });
});

/** Flat task list for exports (CSV / Excel / PDF are produced client-side). */
export const tasks = asyncHandler(async (req, res) => {
  const match = scopedMatch(req);
  const rows = await Task.find(match)
    .select(LIST_FIELDS + ' estimatedHours actualHours assignedBy committee project startDate')
    .populate([...LIST_POP, { path: 'assignedBy', select: 'name' }, { path: 'committee', select: 'name' }, { path: 'project', select: 'title' }])
    .sort('-createdAt')
    .limit(5000)
    .lean();
  ok(res, rows);
});

const METHODOLOGY =
  'Effort points = estimated hours (or a priority default: critical 8h, high 5h, medium 3h, low 1h when unestimated) × priority weight (critical 2, high 1.5, medium 1, low 0.75). ' +
  'Raw task counts are shown for transparency but should not be read as a complete measure of performance; committee roles, project management and task complexity are reported separately.';
