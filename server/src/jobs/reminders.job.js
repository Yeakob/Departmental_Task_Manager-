import '../models/index.js'; // register every model so populate() works regardless of load order
import Task from '../models/Task.js';
import Department from '../models/Department.js';
import Meeting from '../models/Meeting.js';
import UserPreference from '../models/UserPreference.js';
import User from '../models/User.js';
import { notify } from '../services/notification.service.js';
import { sendEmail } from '../services/email.service.js';
import { OPEN_STATUSES, REMINDER_OFFSETS_MINUTES } from '../config/constants.js';
import { logger } from '../config/logger.js';

const human = (min) => (min >= 1440 ? `${Math.round(min / 1440)} day${min >= 2880 ? 's' : ''}` : min >= 60 ? `${Math.round(min / 60)} hour${min >= 120 ? 's' : ''}` : `${min} minutes`);

/**
 * Sends one reminder per configured offset window (e.g. 7d, 3d, 1d, 1h).
 * Only the window the task is currently in fires; dedupeKey (task+offset+deadline)
 * guarantees a reminder is never sent twice, and a moved deadline gets fresh reminders.
 */
export async function deadlineReminders() {
  const depts = await Department.find().select('settings.reminderOffsetsMinutes').lean();
  const offsetsByDept = new Map(depts.map((d) => [String(d._id), (d.settings?.reminderOffsetsMinutes?.length ? d.settings.reminderOffsetsMinutes : REMINDER_OFFSETS_MINUTES).slice().sort((a, b) => a - b)]));
  const maxOffset = Math.max(...REMINDER_OFFSETS_MINUTES, ...[...offsetsByDept.values()].flat());
  const now = Date.now();

  const tasks = await Task.find({ status: { $in: OPEN_STATUSES }, isTemplate: false, deadline: { $gt: new Date(now), $lte: new Date(now + maxOffset * 60000) } })
    .select('taskId title deadline assignees supporters department lastReminderOffset')
    .lean();

  let sent = 0;
  for (const t of tasks) {
    const offsets = offsetsByDept.get(String(t.department)) || REMINDER_OFFSETS_MINUTES;
    const minutesLeft = (t.deadline - now) / 60000;
    const offset = offsets.find((o) => minutesLeft <= o);
    if (offset == null) continue;
    const res = await notify({
      recipients: [...t.assignees.map((a) => a.user), ...(t.supporters || [])],
      type: 'deadline_approaching',
      title: `Due in ${human(offset)}: ${t.taskId}`,
      message: `"${t.title}" is due ${new Date(t.deadline).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}.`,
      entityType: 'task',
      entityId: t._id,
      link: `/tasks/${t._id}`,
      dedupeKeyBase: `reminder:${t._id}:${offset}:${+new Date(t.deadline)}`,
      email: offset >= 1440 || offset <= 60,
    });
    if (res.length) {
      sent += res.length;
      await Task.updateOne({ _id: t._id }, { lastReminderOffset: offset });
    }
  }
  return sent;
}

export async function overdueAlerts() {
  const now = new Date();
  const tasks = await Task.find({
    status: { $in: OPEN_STATUSES },
    isTemplate: false,
    deadline: { $lt: now },
    $or: [{ overdueNotifiedAt: null }, { $expr: { $lt: ['$overdueNotifiedAt', '$deadline'] } }],
  })
    .select('taskId title deadline assignees assignedBy')
    .limit(500)
    .lean();
  for (const t of tasks) {
    await notify({
      recipients: [...t.assignees.map((a) => a.user), t.assignedBy],
      type: 'task_overdue',
      title: `Overdue: ${t.taskId}`,
      message: `"${t.title}" passed its deadline (${new Date(t.deadline).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}).`,
      entityType: 'task',
      entityId: t._id,
      link: `/tasks/${t._id}`,
      dedupeKeyBase: `overdue:${t._id}:${+new Date(t.deadline)}`,
    });
    await Task.updateOne({ _id: t._id }, { overdueNotifiedAt: now });
  }
  return tasks.length;
}

export async function meetingReminders() {
  const now = Date.now();
  const meetings = await Meeting.find({ status: 'scheduled', startAt: { $gt: new Date(now), $lte: new Date(now + 60 * 60000) } }).select('title startAt location participants organizer').lean();
  for (const m of meetings) {
    await notify({
      recipients: [...m.participants.filter((p) => p.attendance !== 'declined').map((p) => p.user), m.organizer],
      type: 'meeting_invited',
      title: `Meeting starts soon: ${m.title}`,
      message: `Starts at ${new Date(m.startAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })}${m.location ? ` in ${m.location}` : ''}.`,
      entityType: 'meeting',
      entityId: m._id,
      link: `/meetings/${m._id}`,
      dedupeKeyBase: `meeting-reminder:${m._id}:${+new Date(m.startAt)}`,
      email: false,
    });
  }
}

/** Optional daily summary email for users who opted in. */
export async function dailySummary() {
  const prefs = await UserPreference.find({ 'notifications.dailySummary': true }).select('user').lean();
  const now = new Date();
  const soon = new Date(+now + 3 * 86400000);
  for (const p of prefs) {
    const user = await User.findById(p.user).select('name email isActive').lean();
    if (!user?.isActive) continue;
    const tasks = await Task.find({ 'assignees.user': p.user, status: { $in: OPEN_STATUSES }, isTemplate: false }).select('taskId title deadline status').sort('deadline').limit(30).lean();
    if (!tasks.length) continue;
    const overdue = tasks.filter((t) => t.deadline && t.deadline < now);
    const dueSoon = tasks.filter((t) => t.deadline && t.deadline >= now && t.deadline <= soon);
    const li = (t) => `<li><strong>${t.taskId}</strong> — ${t.title.replace(/</g, '&lt;')}${t.deadline ? ` <span style="color:#6b7280">(due ${new Date(t.deadline).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })})</span>` : ''}</li>`;
    const body = `<p>Good morning ${user.name.split(' ')[0]}, you have <strong>${tasks.length}</strong> open task(s).</p>
      ${overdue.length ? `<p style="color:#dc2626"><strong>Overdue (${overdue.length})</strong></p><ul>${overdue.map(li).join('')}</ul>` : ''}
      ${dueSoon.length ? `<p><strong>Due in the next 3 days (${dueSoon.length})</strong></p><ul>${dueSoon.map(li).join('')}</ul>` : ''}`;
    await sendEmail({ to: user.email, subject: 'Your DWMT daily task summary', title: 'Daily task summary', body, actionPath: '/tasks/my', actionLabel: 'Open my tasks' });
  }
}

export async function safely(name, fn) {
  try {
    const r = await fn();
    logger.debug({ job: name, result: r }, 'job finished');
  } catch (err) {
    logger.error({ err, job: name }, 'job failed');
  }
}
