import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/documents.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { objectIdParam, paginationQuery } from '../validators/common.js';

const router = Router();
router.use(authenticate);

const listQuery = paginationQuery.extend({
  category: z.string().optional(), task: z.string().optional(), project: z.string().optional(), committee: z.string().optional(),
  meeting: z.string().optional(), uploadedBy: z.string().optional(), from: z.string().optional(), to: z.string().optional(),
});

router.get('/', authorize('document:read'), validate({ query: listQuery }), c.list);
router.post('/', authorize('document:upload'), upload.single('file'), c.upload);
router.get('/:id', authorize('document:read'), validate({ params: objectIdParam }), c.getOne);
router.get('/:id/download', authorize('document:read'), validate({ params: objectIdParam }), c.download);
router.post('/:id/versions', authorize('document:upload'), upload.single('file'), validate({ params: objectIdParam }), c.addVersion);
router.patch('/:id', validate({ params: objectIdParam }), c.update);
router.delete('/:id', validate({ params: objectIdParam }), c.remove);
router.delete('/:id/purge', authorize('document:delete'), validate({ params: objectIdParam }), c.purge);

export default router;
