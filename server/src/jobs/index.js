import cron from 'node-cron';
import { deadlineReminders, overdueAlerts, meetingReminders, dailySummary, safely } from './reminders.job.js';
import { processDueRecurring } from './recurring.job.js';
import { logger } from '../config/logger.js';

export function startJobs() {
  if (process.env.DISABLE_JOBS === 'true') return logger.info('Background jobs disabled');
  cron.schedule('*/5 * * * *', () => safely('deadline-reminders', deadlineReminders));
  cron.schedule('*/10 * * * *', () => safely('overdue-alerts', overdueAlerts));
  cron.schedule('*/5 * * * *', () => safely('meeting-reminders', meetingReminders));
  cron.schedule('*/15 * * * *', () => safely('recurring-tasks', processDueRecurring));
  cron.schedule('0 8 * * *', () => safely('daily-summary', dailySummary), { timezone: 'Asia/Dhaka' });
  logger.info('Background jobs scheduled');
}
