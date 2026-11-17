import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { loginSchema, registerSchema, changePasswordSchema, updateProfileSchema } from '../validators/auth.validators.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many login attempts; try again later' } });

router.post('/login', loginLimiter, validate({ body: loginSchema }), ctrl.login);
// Registration is restricted to admins; open self-registration is intentionally disabled.
router.post('/register', authenticate, authorize('user:manage'), validate({ body: registerSchema }), ctrl.register);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), ctrl.updateProfile);
router.post('/me/avatar', authenticate, upload.single('avatar'), ctrl.uploadAvatar);
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), ctrl.changePassword);

export default router;
