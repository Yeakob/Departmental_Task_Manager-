import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/projects.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectId, objectIdParam, paginationQuery } from '../validators/common.js';
import { PROJECT_STATUSES } from '../config/constants.js';

const router = Router();
router.use(authenticate);

const projectBody = z.object({
  title: z.string().trim().min(3).max(200),
  code: z.string().trim().max(30).optional(),
  description: z.string().max(20000).optional(),
  manager: objectId,
  members: z.array(objectId).optional().default([]),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  budget: z.object({ amount: z.number().min(0).optional(), currency: z.string().max(5).optional() }).optional(),
  department: objectId.optional(),
});

const milestoneBody = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  order: z.number().int().optional(),
});

const listQuery = paginationQuery.extend({ status: z.string().optional(), archived: z.enum(['true', 'false']).optional(), mine: z.enum(['true', 'false']).optional() });
const withMilestone = z.object({ id: objectId, milestoneId: objectId });

router.get('/', authorize('project:read'), validate({ query: listQuery }), c.list);
router.post('/', authorize('project:create'), validate({ body: projectBody }), c.create);
router.get('/:id', authorize('project:read'), validate({ params: objectIdParam }), c.getOne);
router.get('/:id/timeline', authorize('project:read'), validate({ params: objectIdParam }), c.timeline);
router.patch('/:id', validate({ params: objectIdParam, body: projectBody.partial() }), c.update);
router.delete('/:id', authorize('project:delete'), validate({ params: objectIdParam }), c.remove);

router.post('/:id/milestones', validate({ params: objectIdParam, body: milestoneBody }), c.addMilestone);
router.patch('/:id/milestones/:milestoneId', validate({ params: withMilestone, body: milestoneBody.partial() }), c.updateMilestone);
router.delete('/:id/milestones/:milestoneId', validate({ params: withMilestone }), c.deleteMilestone);

export default router;
