import { Router } from 'express';
import authRoutes from './auth.routes.js';
import taskRoutes from './tasks.routes.js';
import projectRoutes from './projects.routes.js';
import committeeRoutes from './committees.routes.js';
import meetingRoutes from './meetings.routes.js';
import documentRoutes from './documents.routes.js';
import announcementRoutes from './announcements.routes.js';
import notificationRoutes from './notifications.routes.js';
import calendarRoutes from './calendar.routes.js';
import reportRoutes from './reports.routes.js';
import searchRoutes from './search.routes.js';
import recurringRoutes from './recurring.routes.js';
import systemRoutes from './system.routes.js';
import { usersRouter, rolesRouter, departmentsRouter, categoriesRouter, sessionsRouter, auditRouter } from './admin.routes.js';

/** [mountPath, router, tag] — also consumed by the OpenAPI generator. */
export const modules = [
  ['/auth', authRoutes, 'Auth'],
  ['/users', usersRouter, 'Users'],
  ['/roles', rolesRouter, 'Roles & Permissions'],
  ['/departments', departmentsRouter, 'Departments'],
  ['/categories', categoriesRouter, 'Task Categories'],
  ['/academic-sessions', sessionsRouter, 'Academic Sessions'],
  ['/tasks', taskRoutes, 'Tasks'],
  ['/recurring-tasks', recurringRoutes, 'Recurring Tasks'],
  ['/projects', projectRoutes, 'Projects'],
  ['/committees', committeeRoutes, 'Committees'],
  ['/meetings', meetingRoutes, 'Meetings'],
  ['/documents', documentRoutes, 'Documents'],
  ['/announcements', announcementRoutes, 'Announcements'],
  ['/notifications', notificationRoutes, 'Notifications'],
  ['/calendar', calendarRoutes, 'Calendar'],
  ['/reports', reportRoutes, 'Reports'],
  ['/search', searchRoutes, 'Search'],
  ['/audit-logs', auditRouter, 'Audit'],
  ['/system', systemRoutes, 'System'],
];

const api = Router();
for (const [path, router] of modules) api.use(path, router);
export default api;
