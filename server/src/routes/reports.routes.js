import { Router } from 'express';
import * as c from '../controllers/reports.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/dashboard', c.dashboard);
router.get('/faculty', authorize('report:faculty', 'report:self'), c.faculty);
router.get('/department', authorize('report:department'), c.department);
router.get('/tasks', authorize('report:department', 'report:faculty'), c.tasks);
export default router;
