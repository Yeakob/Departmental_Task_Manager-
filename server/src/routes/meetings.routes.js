import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/meetings.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectId, objectIdParam, paginationQuery } from '../validators/common.js';
import { MEETING_STATUSES, PRIORITIES } from '../config/constants.js';

const router = Router();
router.use(authenticate);

const body = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(10000).optional(),
  committee: objectId.nullable().optional(),
  project: objectId.nullable().optional(),
  participants: z.array(objectId).optional().default([]),
  agenda: z.array(z.object({ title: z.string().trim().min(1).max(300), presenter: objectId.nullable().optional(), durationMinutes: z.number().int().min(0).max(600).optional(), notes: z.string().max(2000).optional(), order: z.number().int().optional() })).optional(),
  location: z.string().trim().max(200).optional(),
  meetingLink: z.string().trim().url().max(500).optional().or(z.literal('')),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: z.enum(MEETING_STATUSES).optional(),
  department: objectId.optional(),
});

const decision = z.object({
  title: z.string().trim().min(2).max(300),
  details: z.string().max(5000).optional(),
  responsible: z.array(objectId).optional().default([]),
  deadline: z.coerce.date().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'implemented', 'dropped']).optional(),
});

const sub = z.object({ id: objectId, decisionId: objectId });
const listQuery = paginationQuery.extend({ committee: objectId.optional(), status: z.string().optional(), from: z.string().optional(), to: z.string().optional(), upcoming: z.enum(['true', 'false']).optional(), mine: z.enum(['true', 'false']).optional() });

router.get('/', authorize('meeting:read'), validate({ query: listQuery }), c.list);
router.post('/', authorize('meeting:create'), validate({ body }), c.create);
router.get('/:id', authorize('meeting:read'), validate({ params: objectIdParam }), c.getOne);
router.patch('/:id', validate({ params: objectIdParam, body: body.partial() }), c.update);
router.delete('/:id', validate({ params: objectIdParam }), c.remove);
router.patch('/:id/attendance', validate({ params: objectIdParam, body: z.object({ rsvp: z.enum(['accepted', 'declined']).optional(), entries: z.array(z.object({ user: objectId, attendance: z.enum(['invited', 'accepted', 'declined', 'present', 'absent']) })).optional() }) }), c.attendance);
router.put('/:id/minutes', validate({ params: objectIdParam, body: z.object({ body: z.string().max(100000).optional(), document: objectId.nullable().optional() }) }), c.saveMinutes);
router.post('/:id/decisions', validate({ params: objectIdParam, body: decision }), c.addDecision);
router.patch('/:id/decisions/:decisionId', validate({ params: sub, body: decision.partial() }), c.updateDecision);
router.delete('/:id/decisions/:decisionId', validate({ params: sub }), c.deleteDecision);
router.post('/:id/decisions/:decisionId/convert', authorize('task:assign'), validate({ params: sub, body: z.object({ deadline: z.coerce.date().optional(), priority: z.enum(PRIORITIES).optional(), category: objectId.optional() }) }), c.convertDecision);

export default router;
