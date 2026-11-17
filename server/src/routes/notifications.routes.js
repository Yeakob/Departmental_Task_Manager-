import { Router } from 'express';
import { z } from 'zod';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam, paginationQuery } from '../validators/common.js';
import { asyncHandler, ok, parsePagination, paginate } from '../utils/http.js';
import { ApiError } from '../utils/ApiError.js';
import { emitToUser } from '../sockets/index.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: paginationQuery.extend({ unread: z.enum(['true', 'false']).optional(), type: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  if (req.query.type) filter.type = { $in: req.query.type.split(',') };
  const { items, meta } = await paginate(Notification, filter, parsePagination(req.query), [{ path: 'actor', select: 'name avatar' }]);
  const unread = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
  ok(res, items, { ...meta, unread });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  ok(res, { count: await Notification.countDocuments({ recipient: req.user._id, readAt: null }) });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ recipient: req.user._id, readAt: null }, { readAt: new Date() });
  emitToUser(req.user._id, 'notification:count', { count: 0 });
  ok(res, { updated: r.modifiedCount });
}));

router.patch('/:id/read', validate({ params: objectIdParam }), asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { readAt: new Date() }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found');
  ok(res, n);
}));

router.patch('/:id/unread', validate({ params: objectIdParam }), asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { readAt: null }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found');
  ok(res, n);
}));

router.delete('/:id', validate({ params: objectIdParam }), asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
  ok(res, { deleted: true });
}));

export default router;
