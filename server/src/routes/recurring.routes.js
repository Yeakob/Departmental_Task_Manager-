import { Router } from 'express';
import { z } from 'zod';
import RecurringTask from '../models/RecurringTask.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectId, objectIdParam } from '../validators/common.js';
import { asyncHandler, ok, created } from '../utils/http.js';
import { ensureSameDept, targetDept } from '../utils/access.js';
import { computeNextRun, runRecurring } from '../jobs/recurring.job.js';
import { PRIORITIES } from '../config/constants.js';

const router = Router();
router.use(authenticate, authorize('task:bulk'));

const body = z.object({
  name: z.string().trim().min(2).max(150),
  template: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().max(20000).optional(),
    category: objectId.nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignees: z.array(objectId).min(1),
    committee: objectId.nullable().optional(),
    project: objectId.nullable().optional(),
    estimatedHours: z.number().min(0).optional(),
    requiresApproval: z.boolean().optional(),
    durationDays: z.number().int().min(1).max(365).optional(),
  }),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'semester', 'annually']),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  month: z.number().int().min(0).max(11).optional(),
  startAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const items = await RecurringTask.find(req.isSuperAdmin ? {} : { department: req.departmentId }).populate('template.assignees', 'name avatar').populate('createdBy', 'name').sort('nextRunAt').lean();
  ok(res, items);
}));

router.post('/', validate({ body }), asyncHandler(async (req, res) => {
  const department = targetDept(req);
  const { startAt, ...rest } = req.body;
  const doc = new RecurringTask({ ...rest, department, createdBy: req.user._id, nextRunAt: startAt || new Date() });
  if (!startAt) doc.nextRunAt = computeNextRun(doc, new Date(Date.now() - 60000));
  await doc.save();
  created(res, doc);
}));

router.patch('/:id', validate({ params: objectIdParam, body: body.partial() }), asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await RecurringTask.findById(req.params.id), 'Recurring task');
  const { startAt, ...rest } = req.body;
  Object.assign(doc, rest);
  if (startAt) doc.nextRunAt = startAt;
  else if (rest.frequency || rest.dayOfWeek !== undefined || rest.dayOfMonth !== undefined) doc.nextRunAt = computeNextRun(doc, new Date());
  await doc.save();
  ok(res, doc);
}));

router.delete('/:id', validate({ params: objectIdParam }), asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await RecurringTask.findById(req.params.id), 'Recurring task');
  await doc.deleteOne();
  ok(res, { deleted: true });
}));

router.post('/:id/run', validate({ params: objectIdParam }), asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await RecurringTask.findById(req.params.id), 'Recurring task');
  const task = await runRecurring(doc, { force: true });
  created(res, task);
}));

export default router;
