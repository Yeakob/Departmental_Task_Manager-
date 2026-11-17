import { Router } from 'express';
import { z } from 'zod';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Committee from '../models/Committee.js';
import Meeting from '../models/Meeting.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import UserPreference from '../models/UserPreference.js';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ok, escapeRegex } from '../utils/http.js';
import { buildTaskFilter } from '../controllers/tasks.controller.js';

const router = Router();
router.use(authenticate);

/** Global search across modules, respecting department and permission scope. */
router.get('/', validate({ query: z.object({ q: z.string().trim().min(1).max(100), limit: z.coerce.number().int().min(1).max(20).optional(), types: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const { q } = req.query;
  const limit = req.query.limit || 6;
  const types = req.query.types ? req.query.types.split(',') : ['tasks', 'projects', 'committees', 'meetings', 'documents', 'users'];
  const rx = new RegExp(escapeRegex(q), 'i');
  const dept = req.isSuperAdmin ? {} : { department: req.departmentId };
  const seesAll = req.isSuperAdmin || hasPermission(req, 'task:read_all');
  const want = (t) => types.includes(t);

  const taskFilter = buildTaskFilter(req, { q });
  delete taskFilter.parentTask;

  const [tasks, projects, committees, meetings, documents, users] = await Promise.all([
    want('tasks') ? Task.find(taskFilter).select('taskId title status priority deadline').sort('-updatedAt').limit(limit).lean() : [],
    want('projects') ? Project.find({ ...dept, $or: [{ title: rx }, { code: rx }, { description: rx }] }).select('title status').limit(limit).lean() : [],
    want('committees') ? Committee.find({ ...dept, $or: [{ name: rx }, { description: rx }] }).select('name').limit(limit).lean() : [],
    want('meetings')
      ? Meeting.find({ ...dept, $or: [{ title: rx }, { description: rx }], ...(seesAll ? {} : { $and: [{ $or: [{ organizer: req.user._id }, { 'participants.user': req.user._id }] }] }) }).select('title startAt').sort('-startAt').limit(limit).lean()
      : [],
    want('documents')
      ? Document.find({ ...dept, $and: [{ $or: [{ title: rx }, { tags: rx }, { description: rx }] }, ...(seesAll ? [] : [{ $or: [{ visibility: 'department' }, { uploadedBy: req.user._id }, { allowedUsers: req.user._id }] }])] }).select('title category').limit(limit).lean()
      : [],
    want('users') ? User.find({ ...dept, isActive: true, $or: [{ name: rx }, { email: rx }, { designation: rx }] }).select('name email avatar designation').limit(limit).lean() : [],
  ]);

  UserPreference.updateOne({ user: req.user._id }, [{ $set: { recentSearches: { $slice: [{ $concatArrays: [[q], { $filter: { input: { $ifNull: ['$recentSearches', []] }, cond: { $ne: ['$$this', q] } } }] }, 10] } } }], { upsert: true }).catch(() => {});

  ok(res, { tasks, projects, committees, meetings, documents, users });
}));

export default router;
