/**
 * Runs the background jobs twice against the current database and checks they don't duplicate.
 *   node scripts/jobs-test.mjs   (use a seeded development database)
 */
import '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import mongoose from 'mongoose';
import { deadlineReminders, overdueAlerts, meetingReminders } from '../src/jobs/reminders.job.js';
import { processDueRecurring } from '../src/jobs/recurring.job.js';
import Notification from '../src/models/Notification.js';
import RecurringTask from '../src/models/RecurringTask.js';
import Task from '../src/models/Task.js';

await connectDB();
const count = (type) => Notification.countDocuments({ type });
const r1 = await deadlineReminders(); const o1 = await overdueAlerts(); await meetingReminders();
const after1 = { reminders: await count('deadline_approaching'), overdue: await count('task_overdue') };
const r2 = await deadlineReminders(); const o2 = await overdueAlerts();
const after2 = { reminders: await count('deadline_approaching'), overdue: await count('task_overdue') };
console.log('run 1 sent', r1, 'reminders,', o1, 'overdue tasks', after1);
console.log('run 2 sent', r2, 'reminders,', o2, 'overdue tasks', after2, after1.reminders === after2.reminders && after1.overdue === after2.overdue ? '-> no duplicates' : '-> DUPLICATES');

await RecurringTask.updateMany({}, { nextRunAt: new Date(Date.now() - 60000) });
const before = await Task.countDocuments({ tags: 'recurring' });
await processDueRecurring(); await processDueRecurring();
const rt = await RecurringTask.findOne().lean();
console.log('recurring tasks created:', (await Task.countDocuments({ tags: 'recurring' })) - before, '| next run', rt.nextRunAt.toISOString().slice(0, 10));
await mongoose.disconnect();
