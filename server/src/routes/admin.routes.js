import { Router } from 'express';
import * as users from '../controllers/users.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import {
  createUserSchema, updateUserSchema, resetPasswordSchema, listUsersQuery, roleSchema, updateRoleSchema,
  departmentSchema, updateDepartmentSchema, categorySchema, academicSessionSchema, auditQuery,
} from '../validators/admin.validators.js';

export const usersRouter = Router();
usersRouter.use(authenticate);
usersRouter.get('/directory', users.directory);
usersRouter.get('/me/preferences', users.preferences);
usersRouter.patch('/me/preferences', users.updatePreferences);
usersRouter.get('/', authorize('user:read'), validate({ query: listUsersQuery }), users.list);
usersRouter.post('/', authorize('user:manage'), validate({ body: createUserSchema }), users.create);
usersRouter.get('/:id', authorize('user:read'), validate({ params: objectIdParam }), users.getOne);
usersRouter.patch('/:id', authorize('user:manage'), validate({ params: objectIdParam, body: updateUserSchema }), users.update);
usersRouter.post('/:id/reset-password', authorize('user:manage'), validate({ params: objectIdParam, body: resetPasswordSchema }), users.resetPassword);
usersRouter.delete('/:id', authorize('user:manage'), validate({ params: objectIdParam }), users.remove);

export const rolesRouter = Router();
rolesRouter.use(authenticate);
rolesRouter.get('/', admin.listRoles);
rolesRouter.get('/permissions', authorize('role:manage'), admin.listPermissions);
rolesRouter.post('/', authorize('role:manage'), validate({ body: roleSchema }), admin.createRole);
rolesRouter.patch('/:id', authorize('role:manage'), validate({ params: objectIdParam, body: updateRoleSchema }), admin.updateRole);
rolesRouter.delete('/:id', authorize('role:manage'), validate({ params: objectIdParam }), admin.deleteRole);

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);
departmentsRouter.get('/', admin.listDepartments);
departmentsRouter.post('/', authorize('department:manage'), validate({ body: departmentSchema }), admin.createDepartment);
departmentsRouter.patch('/:id', authorize('department:manage', 'user:manage'), validate({ params: objectIdParam, body: updateDepartmentSchema }), admin.updateDepartment);
departmentsRouter.delete('/:id', authorize('department:manage'), validate({ params: objectIdParam }), admin.deleteDepartment);

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);
categoriesRouter.get('/', admin.listCategories);
categoriesRouter.post('/', authorize('category:manage'), validate({ body: categorySchema }), admin.createCategory);
categoriesRouter.patch('/:id', authorize('category:manage'), validate({ params: objectIdParam, body: categorySchema.partial() }), admin.updateCategory);
categoriesRouter.delete('/:id', authorize('category:manage'), validate({ params: objectIdParam }), admin.deleteCategory);

export const sessionsRouter = Router();
sessionsRouter.use(authenticate);
sessionsRouter.get('/', admin.listSessions);
sessionsRouter.post('/', authorize('system:manage', 'user:manage'), validate({ body: academicSessionSchema }), admin.createSession);
sessionsRouter.patch('/:id', authorize('system:manage', 'user:manage'), validate({ params: objectIdParam, body: academicSessionSchema.partial() }), admin.updateSession);
sessionsRouter.delete('/:id', authorize('system:manage'), validate({ params: objectIdParam }), admin.deleteSession);

export const auditRouter = Router();
auditRouter.use(authenticate, authorize('audit:read'));
auditRouter.get('/', validate({ query: auditQuery }), admin.listAudit);
