import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Committee from '../models/Committee.js';
import Project from '../models/Project.js';
import Approval from '../models/Approval.js';
import { OPEN_STATUSES } from '../config/constants.js';

/**
 * Effort points: estimated hours (or a priority-based default when unestimated)
 * multiplied by a priority weight. Used so that performance metrics reflect task
 * size and criticality, not just raw counts.
 */
export const PRIORITY_WEIGHT = { critical: 2, high: 1.5, medium: 1, low: 0.75 };
export const DEFAULT_HOURS = { critical: 8, high: 5, medium: 3, low: 1 };

export const effortExpr = {
  $multiply: [
    { $cond: [{ $gt: ['$estimatedHours', 0] }, '$estimatedHours', { $switch: { branches: Object.entries(DEFAULT_HOURS).map(([k, v]) => ({ case: { $eq: ['$priority', k] }, then: v })), default: 3 } }] },
    { $switch: { branches: Object.entries(PRIORITY_WEIGHT).map(([k, v]) => ({ case: { $eq: ['$priority', k] }, then: v })), default: 1 } },
  ],
};

const isOpen = { $in: ['$status', OPEN_STATUSES] };
const isOverdue = (now) => ({ $and: [isOpen, { $ne: ['$deadline', null] }, { $lt: ['$deadline', now] }] });

/** Cast a find-style filter (string ids) into an aggregate-safe one. */
export const castFilter = (filter) => Task.find().cast(Task, filter);

export async function statusCounts(match) {
  const now = new Date();
  const [row] = await Task.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $in: ['$status', ['draft', 'assigned', 'acknowledged']] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $in: ['$status', ['in_progress', 'revision_required']] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        overdue: { $sum: { $cond: [isOverdue(now), 1, 0] } },
        awaitingApproval: { $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] } },
        onHold: { $sum: { $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0] } },
      },
    },
  ]);
  return row ? { ...row, _id: undefined } : { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, awaitingApproval: 0, onHold: 0 };
}

export async function groupCount(match, field) {
  const rows = await Task.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  return rows.map((r) => ({ key: r._id, count: r.count }));
}

export async function byCategory(match) {
  return Task.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        overdue: { $sum: { $cond: [isOverdue(new Date()), 1, 0] } },
        avgDays: { $avg: { $cond: [{ $and: ['$completedAt', '$createdAt'] }, { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 86400000] }, null] } },
      },
    },
    { $lookup: { from: 'taskcategories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $project: { _id: 0, id: '$_id', name: { $ifNull: [{ $first: '$cat.name' }, 'Uncategorized'] }, color: { $first: '$cat.color' }, total: 1, completed: 1, overdue: 1, avgDays: { $round: ['$avgDays', 1] } } },
    { $sort: { total: -1 } },
  ]);
}

/** Weekly buckets (ISO weeks starting Sunday in Asia/Dhaka) of created vs completed. */
export async function weeklyTrend(match, weeks = 8) {
  const since = new Date(Date.now() - weeks * 7 * 86400000);
  const tz = 'Asia/Dhaka';
  const [created, completed] = await Promise.all([
    Task.aggregate([{ $match: { ...match, createdAt: { $gte: since } } }, { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, n: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { ...match, completedAt: { $gte: since } } }, { $group: { _id: { $dateTrunc: { date: '$completedAt', unit: 'week', timezone: tz } }, n: { $sum: 1 }, onTime: { $sum: { $cond: [{ $or: [{ $eq: ['$deadline', null] }, { $lte: ['$completedAt', '$deadline'] }] }, 1, 0] } } } }]),
  ]);
  return mergeBuckets(created, completed, dhakaDay, periods(since, 'week'));
}

export async function monthlyTrend(match, months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1), 1);
  since.setHours(0, 0, 0, 0);
  const tz = 'Asia/Dhaka';
  const [created, completed] = await Promise.all([
    Task.aggregate([{ $match: { ...match, createdAt: { $gte: since } } }, { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'month', timezone: tz } }, n: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { ...match, completedAt: { $gte: since } } }, { $group: { _id: { $dateTrunc: { date: '$completedAt', unit: 'month', timezone: tz } }, n: { $sum: 1 }, onTime: { $sum: { $cond: [{ $or: [{ $eq: ['$deadline', null] }, { $lte: ['$completedAt', '$deadline'] }] }, 1, 0] } }, effort: { $sum: effortExpr } } }]),
  ]);
  return mergeBuckets(created, completed, (d) => dhakaDay(d).slice(0, 7), periods(since, 'month'));
}

/** Buckets are truncated in Asia/Dhaka, so label them in that zone too (UTC labels shift a day/month). */
const dhakaDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

/** Every bucket label from `since` to now, so quiet periods show as zero instead of disappearing. */
function periods(since, unit) {
  const out = [];
  const [y, m, d] = dhakaDay(since).split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, unit === 'month' ? 1 : d));
  if (unit === 'week') cur.setUTCDate(cur.getUTCDate() - cur.getUTCDay()); // weeks start Sunday, as $dateTrunc does
  const end = dhakaDay(new Date());
  while (cur.toISOString().slice(0, 10) <= end) {
    out.push(unit === 'month' ? cur.toISOString().slice(0, 7) : cur.toISOString().slice(0, 10));
    if (unit === 'month') cur.setUTCMonth(cur.getUTCMonth() + 1);
    else cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return out;
}

function mergeBuckets(created, completed, label, allPeriods = []) {
  const map = new Map(allPeriods.map((p) => [p, { period: p, created: 0, completed: 0, onTime: 0, effort: 0 }]));
  const get = (d) => {
    const key = label(d);
    if (!map.has(key)) map.set(key, { period: key, created: 0, completed: 0, onTime: 0, effort: 0 });
    return map.get(key);
  };
  for (const r of created) get(r._id).created = r.n;
  for (const r of completed) Object.assign(get(r._id), { completed: r.n, onTime: r.onTime, effort: Math.round(r.effort || 0) });
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period)).map((v) => ({ ...v, onTimeRate: v.completed ? Math.round((v.onTime / v.completed) * 100) : null }));
}

/** Per-person metrics. `match` must already be scoped to a department. */
export async function facultyMetrics(match, { userIds } = {}) {
  const now = new Date();
  const rows = await Task.aggregate([
    { $match: match },
    { $unwind: '$assignees' },
    ...(userIds?.length ? [{ $match: { 'assignees.user': { $in: userIds.map((u) => new mongoose.Types.ObjectId(String(u))) } } }] : []),
    {
      $group: {
        _id: '$assignees.user',
        assigned: { $sum: 1 },
        primary: { $sum: { $cond: ['$assignees.isPrimary', 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        pending: { $sum: { $cond: [isOpen, 1, 0] } },
        overdue: { $sum: { $cond: [isOverdue(now), 1, 0] } },
        onTime: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $or: [{ $eq: ['$deadline', null] }, { $lte: ['$completedAt', '$deadline'] }] }] }, 1, 0] } },
        avgDays: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 86400000] }, null] } },
        effortAssigned: { $sum: effortExpr },
        effortCompleted: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, effortExpr, 0] } },
        openHours: { $sum: { $cond: [isOpen, { $ifNull: ['$estimatedHours', 0] }, 0] } },
        actualHours: { $sum: { $ifNull: ['$actualHours', 0] } },
        critical: { $sum: { $cond: [{ $and: [isOpen, { $eq: ['$priority', 'critical'] }] }, 1, 0] } },
      },
    },
  ]);

  const ids = rows.map((r) => r._id);
  const users = await User.find(userIds?.length ? { _id: { $in: userIds } } : { _id: { $in: ids } }).select('name email avatar designation weeklyCapacityHours').lean();
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  const [committeeRoles, managed] = await Promise.all([
    Committee.aggregate([{ $unwind: '$members' }, { $match: { 'members.user': { $in: users.map((u) => u._id) }, deletedAt: null } }, { $group: { _id: '$members.user', n: { $sum: 1 } } }]),
    Project.aggregate([{ $match: { manager: { $in: users.map((u) => u._id) }, status: { $in: ['planning', 'active'] } } }, { $group: { _id: '$manager', n: { $sum: 1 } } }]),
  ]);
  const cMap = new Map(committeeRoles.map((r) => [String(r._id), r.n]));
  const pMap = new Map(managed.map((r) => [String(r._id), r.n]));

  return users
    .map((u) => {
      const r = byId.get(String(u._id)) || {};
      const assigned = r.assigned || 0;
      const completed = r.completed || 0;
      const closedOrOverdue = completed + (r.overdue || 0);
      return {
        user: { id: String(u._id), name: u.name, email: u.email, avatar: u.avatar, designation: u.designation },
        assigned,
        primary: r.primary || 0,
        completed,
        pending: r.pending || 0,
        overdue: r.overdue || 0,
        completionRate: assigned ? Math.round((completed / assigned) * 100) : 0,
        onTimeRate: completed ? Math.round(((r.onTime || 0) / completed) * 100) : null,
        reliability: closedOrOverdue ? Math.round(((r.onTime || 0) / closedOrOverdue) * 100) : null,
        avgCompletionDays: r.avgDays != null ? Math.round(r.avgDays * 10) / 10 : null,
        effortAssigned: Math.round(r.effortAssigned || 0),
        effortCompleted: Math.round(r.effortCompleted || 0),
        openHours: r.openHours || 0,
        actualHours: r.actualHours || 0,
        openCritical: r.critical || 0,
        capacityHours: u.weeklyCapacityHours ?? 40,
        utilization: u.weeklyCapacityHours ? Math.round(((r.openHours || 0) / u.weeklyCapacityHours) * 100) : null,
        committees: cMap.get(String(u._id)) || 0,
        projectsManaged: pMap.get(String(u._id)) || 0,
      };
    })
    .sort((a, b) => b.effortAssigned - a.effortAssigned);
}

export async function overdueAnalysis(match) {
  const now = new Date();
  const base = { ...match, status: { $in: OPEN_STATUSES }, deadline: { $lt: now } };
  const [byPriority, byAge, byCategory] = await Promise.all([
    groupCount(base, 'priority'),
    Task.aggregate([
      { $match: base },
      { $project: { days: { $divide: [{ $subtract: [now, '$deadline'] }, 86400000] } } },
      { $bucket: { groupBy: '$days', boundaries: [0, 3, 7, 30, 1e9], default: 'other', output: { count: { $sum: 1 } } } },
    ]),
    Task.aggregate([
      { $match: base },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $lookup: { from: 'taskcategories', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 0, name: { $ifNull: [{ $first: '$c.name' }, 'Uncategorized'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]),
  ]);
  const labels = { 0: '1–3 days', 3: '4–7 days', 7: '8–30 days', 30: '30+ days' };
  return { byPriority, byAge: byAge.map((b) => ({ bucket: labels[b._id] || b._id, count: b.count })), byCategory };
}

export async function approvalStats(taskIds) {
  const rows = await Approval.aggregate([
    { $match: { task: { $in: taskIds } } },
    { $group: { _id: '$decision', count: { $sum: 1 }, avgHours: { $avg: { $cond: ['$decidedAt', { $divide: [{ $subtract: ['$decidedAt', '$createdAt'] }, 3600000] }, null] } } } },
  ]);
  return rows.map((r) => ({ decision: r._id, count: r.count, avgReviewHours: r.avgHours != null ? Math.round(r.avgHours * 10) / 10 : null }));
}
