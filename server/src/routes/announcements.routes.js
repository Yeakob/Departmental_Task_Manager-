import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/announcements.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectId, objectIdParam, paginationQuery } from '../validators/common.js';

const router = Router();
router.use(authenticate);

const body = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(20000),
  isPinned: z.boolean().optional(),
  priority: z.enum(['normal', 'important', 'urgent']).optional(),
  audienceRoles: z.array(z.string()).optional(),
  publishAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  department: objectId.nullable().optional(),
});

router.get('/', authorize('announcement:read'), validate({ query: paginationQuery.extend({ all: z.string().optional(), pinned: z.string().optional() }) }), c.list);
router.post('/', authorize('announcement:create'), validate({ body }), c.create);
router.get('/:id', authorize('announcement:read'), validate({ params: objectIdParam }), c.getOne);
router.patch('/:id', validate({ params: objectIdParam, body: body.partial() }), c.update);
router.delete('/:id', validate({ params: objectIdParam }), c.remove);

export default router;
