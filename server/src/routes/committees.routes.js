import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/committees.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectId, objectIdParam, paginationQuery } from '../validators/common.js';

const router = Router();
router.use(authenticate);

const body = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().max(5000).optional(),
  coordinator: objectId,
  members: z.array(z.object({ user: objectId, role: z.enum(['coordinator', 'member', 'secretary']).optional() })).optional().default([]),
  responsibilities: z.array(z.string().trim().min(1).max(300)).optional(),
  meetingSchedule: z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
  department: objectId.optional(),
});

router.get('/', authorize('committee:read'), validate({ query: paginationQuery.extend({ mine: z.enum(['true', 'false']).optional(), active: z.string().optional() }) }), c.list);
router.post('/', authorize('committee:create'), validate({ body }), c.create);
router.get('/:id', authorize('committee:read'), validate({ params: objectIdParam }), c.getOne);
router.patch('/:id', authorize('committee:update'), validate({ params: objectIdParam, body: body.partial() }), c.update);
router.delete('/:id', authorize('committee:delete'), validate({ params: objectIdParam }), c.remove);

export default router;
