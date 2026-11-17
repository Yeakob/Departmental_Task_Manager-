import { Router } from 'express';
import * as M from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, ok } from '../utils/http.js';
import { audit } from '../middleware/audit.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => ok(res, { status: 'ok', time: new Date().toISOString(), env: env.nodeEnv }));

/**
 * JSON data export / backup. Super admin: whole system. Chairman: own department.
 * Secrets (password hashes, refresh tokens) are never exported.
 */
router.get('/export', authenticate, authorize('system:manage', 'report:department'), asyncHandler(async (req, res) => {
  const dept = req.isSuperAdmin ? {} : { department: req.departmentId };
  const [users, tasks, projects, committees, meetings, documents, announcements, categories, events] = await Promise.all([
    M.User.find(dept).select('-passwordHash -refreshTokens').lean(),
    M.Task.find(dept).lean(),
    M.Project.find(dept).lean(),
    M.Committee.find(dept).lean(),
    M.Meeting.find(dept).lean(),
    M.Document.find(dept).select('-versions.path').lean(),
    M.Announcement.find(req.isSuperAdmin ? {} : { department: { $in: [req.departmentId, null] } }).lean(),
    M.TaskCategory.find(req.isSuperAdmin ? {} : { department: { $in: [req.departmentId, null] } }).lean(),
    M.CalendarEvent.find(dept).lean(),
  ]);
  const taskIds = tasks.map((t) => t._id);
  const meetingIds = meetings.map((m) => m._id);
  const [comments, checklists, approvals, minutes, decisions, milestones] = await Promise.all([
    M.TaskComment.find({ task: { $in: taskIds } }).lean(),
    M.TaskChecklist.find({ task: { $in: taskIds } }).lean(),
    M.Approval.find({ task: { $in: taskIds } }).lean(),
    M.MeetingMinutes.find({ meeting: { $in: meetingIds } }).lean(),
    M.MeetingDecision.find({ meeting: { $in: meetingIds } }).lean(),
    M.ProjectMilestone.find({ project: { $in: projects.map((p) => p._id) } }).lean(),
  ]);
  audit(req, { action: 'system.export', entityType: 'System' });
  res.setHeader('Content-Disposition', `attachment; filename="dwmt-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date(), exportedBy: req.user.email, users, tasks, comments, checklists, approvals, projects, milestones, committees, meetings, minutes, decisions, documents, announcements, categories, events });
}));

export default router;
