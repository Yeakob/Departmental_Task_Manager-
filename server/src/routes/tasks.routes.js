import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/tasks.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { objectId, objectIdParam } from '../validators/common.js';
import * as v from '../validators/task.validators.js';

const router = Router();
router.use(authenticate);

const id = { params: objectIdParam };
const withSub = (key) => ({ params: z.object({ id: objectId, [key]: objectId }) });

router.get('/', validate({ query: v.listTasksQuery }), c.list);
router.get('/kanban', validate({ query: v.listTasksQuery.extend({ showOld: z.string().optional() }) }), c.kanban);
router.get('/recycle-bin', authorize('task:delete'), c.recycleBin);
router.post('/', authorize('task:create'), validate({ body: v.createTaskSchema }), c.create);

router.post('/bulk', authorize('task:bulk'), validate({ body: v.bulkCreateSchema }), c.bulkCreate);
router.post('/bulk/assign', authorize('task:bulk'), validate({ body: v.bulkAssignSchema }), c.bulkAssign);
router.post('/bulk/status', authorize('task:bulk'), validate({ body: v.bulkStatusSchema }), c.bulkStatus);

router.get('/:id', validate(id), c.getOne);
router.patch('/:id', validate({ ...id, body: v.updateTaskSchema }), c.update);
router.delete('/:id', validate(id), c.remove);
router.post('/:id/restore', authorize('task:delete'), validate(id), c.restore);
router.post('/:id/duplicate', authorize('task:create'), validate(id), c.duplicate);
router.post('/:id/from-template', authorize('task:create'), validate({ ...id, body: z.object({ title: z.string().optional(), assignees: z.array(z.object({ user: objectId, isPrimary: z.boolean().optional() })).optional(), deadline: z.coerce.date().optional(), startDate: z.coerce.date().optional() }) }), c.createFromTemplate);

router.patch('/:id/status', validate({ ...id, body: v.statusSchema }), c.changeStatus);
router.patch('/:id/kanban', validate({ ...id, body: v.kanbanMoveSchema }), c.kanbanMove);
router.patch('/:id/progress', validate({ ...id, body: v.progressSchema }), c.progress);
router.post('/:id/assign', authorize('task:assign'), validate({ ...id, body: v.assignSchema }), c.assign);
router.post('/:id/delegate', validate({ ...id, body: v.delegateSchema }), c.delegate);
router.post('/:id/watch', validate({ ...id, body: v.watchSchema }), c.watch);
router.post('/:id/dependencies', validate({ ...id, body: v.dependencySchema }), c.addDependency);
router.delete('/:id/dependencies/:depId', validate(withSub('depId')), c.removeDependency);

router.post('/:id/extensions', authorize('task:extension_request'), validate({ ...id, body: v.extensionRequestSchema }), c.requestExtension);
router.patch('/:id/extensions/:requestId', validate({ ...withSub('requestId'), body: v.extensionDecisionSchema }), c.decideExtension);

router.post('/:id/submit', authorize('task:submit'), validate({ ...id, body: v.submitSchema }), c.submit);
router.post('/:id/approve', validate({ ...id, body: v.decisionSchema }), c.approve);
router.get('/:id/approvals', validate(id), c.approvals);
router.get('/:id/activity', validate(id), c.activity);

router.get('/:id/comments', validate(id), c.listComments);
router.post('/:id/comments', authorize('task:comment'), validate({ ...id, body: v.commentSchema }), c.addComment);
router.patch('/:id/comments/:commentId', validate({ ...withSub('commentId'), body: z.object({ body: z.string().trim().min(1).max(5000) }) }), c.updateComment);
router.delete('/:id/comments/:commentId', validate(withSub('commentId')), c.deleteComment);

router.post('/:id/checklist', validate({ ...id, body: v.checklistItemSchema }), c.addChecklistItem);
router.patch('/:id/checklist/reorder', validate({ ...id, body: v.checklistReorderSchema }), c.reorderChecklist);
router.patch('/:id/checklist/:itemId', validate({ ...withSub('itemId'), body: z.object({ done: z.boolean().optional(), text: z.string().trim().min(1).max(300).optional() }) }), (req, res, next) =>
  req.body.text !== undefined ? c.updateChecklistItem(req, res, next) : c.toggleChecklistItem(req, res, next)
);
router.delete('/:id/checklist/:itemId', validate(withSub('itemId')), c.deleteChecklistItem);

router.get('/:id/attachments', validate(id), c.listAttachments);
router.post('/:id/attachments', upload.array('files', 10), validate(id), c.uploadAttachments);
router.delete('/:id/attachments/:attachmentId', validate(withSub('attachmentId')), c.deleteAttachment);

export default router;
