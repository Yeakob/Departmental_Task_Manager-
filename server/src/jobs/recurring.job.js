import '../models/index.js'; // register every model so populate() works regardless of load order
import RecurringTask from '../models/RecurringTask.js';
import User from '../models/User.js';
import { createTask } from '../services/task.service.js';
import { logger } from '../config/logger.js';

/** Next occurrence strictly after `after`, based on frequency settings. */
export function computeNextRun(rt, after = new Date()) {
  const base = new Date(rt.nextRunAt && rt.nextRunAt > after ? rt.nextRunAt : after);
  const d = new Date(base);
  d.setSeconds(0, 0);
  const hour = rt.nextRunAt ? new Date(rt.nextRunAt).getHours() : 8;
  const minute = rt.nextRunAt ? new Date(rt.nextRunAt).getMinutes() : 0;
  d.setHours(hour, minute);
  const bump = () => {
    switch (rt.frequency) {
      case 'daily': d.setDate(d.getDate() + 1); break;
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'semester': d.setMonth(d.getMonth() + 6); break;
      case 'annually': d.setFullYear(d.getFullYear() + 1); break;
      default: d.setDate(d.getDate() + 1);
    }
  };
  if (rt.frequency === 'weekly' && rt.dayOfWeek != null) {
    while (d.getDay() !== rt.dayOfWeek) d.setDate(d.getDate() + 1);
  }
  if (['monthly', 'semester', 'annually'].includes(rt.frequency) && rt.dayOfMonth) d.setDate(rt.dayOfMonth);
  if (rt.frequency === 'annually' && rt.month != null) d.setMonth(rt.month);
  let guard = 0;
  while (d <= after && guard++ < 1000) bump();
  return d;
}

/** Builds a request-like context so the normal task service rules apply. */
async function systemReq(userId) {
  const user = await User.findById(userId).populate('roles', 'key permissions').lean();
  if (!user || !user.isActive) return null;
  const permissions = new Set(user.roles.flatMap((r) => r.permissions));
  return { user, permissions, roleKeys: user.roles.map((r) => r.key), isSuperAdmin: permissions.has('*'), departmentId: user.department ? String(user.department) : null };
}

export async function runRecurring(rt, { force = false } = {}) {
  const req = await systemReq(rt.createdBy);
  if (!req) {
    rt.isActive = false;
    await rt.save();
    throw new Error('Recurring task owner is inactive');
  }
  if (req.isSuperAdmin) req.departmentId = String(rt.department);
  const occurrence = force ? new Date() : rt.nextRunAt;
  const t = rt.template;
  const task = await createTask(req, {
    title: `${t.title} — ${occurrence.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    description: t.description || '',
    category: t.category || null,
    priority: t.priority || 'medium',
    assignees: (t.assignees || []).map((u, i) => ({ user: u, isPrimary: i === 0 })),
    committee: t.committee || null,
    project: t.project || null,
    estimatedHours: t.estimatedHours || 0,
    requiresApproval: t.requiresApproval ?? true,
    startDate: occurrence,
    deadline: new Date(+occurrence + (t.durationDays || 7) * 86400000),
    tags: ['recurring'],
  });
  await task.updateOne({ recurringTask: rt._id });
  rt.lastRunAt = new Date();
  if (!force) rt.nextRunAt = computeNextRun(rt, occurrence);
  await rt.save();
  return task;
}

export async function processDueRecurring() {
  const due = await RecurringTask.find({ isActive: true, nextRunAt: { $lte: new Date() } }).limit(100);
  for (const rt of due) {
    try {
      await runRecurring(rt);
      logger.info({ recurring: rt.name }, 'recurring task generated');
    } catch (err) {
      logger.warn({ err, recurring: String(rt._id) }, 'recurring task generation failed');
      rt.nextRunAt = computeNextRun(rt, new Date());
      await rt.save().catch(() => {});
    }
  }
}
