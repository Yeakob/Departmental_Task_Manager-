import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/calendar.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectId, objectIdParam } from '../validators/common.js';

const router = Router();
router.use(authenticate);

const body = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['exam', 'event', 'seminar', 'workshop', 'academic', 'holiday', 'other']).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  allDay: z.boolean().optional(),
  location: z.string().trim().max(200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  committee: objectId.nullable().optional(),
  project: objectId.nullable().optional(),
  department: objectId.optional(),
});

router.get('/events', c.events);
router.get('/export.ics', c.ics);
router.post('/events', authorize('meeting:create', 'announcement:create'), validate({ body }), c.createEvent);
router.patch('/events/:id', validate({ params: objectIdParam, body: body.partial() }), c.updateEvent);
router.delete('/events/:id', validate({ params: objectIdParam }), c.deleteEvent);
router.patch('/reschedule', validate({ body: z.object({ type: z.enum(['task', 'meeting', 'event']), id: objectId, start: z.coerce.date(), end: z.coerce.date().optional() }) }), c.reschedule);

export default router;
