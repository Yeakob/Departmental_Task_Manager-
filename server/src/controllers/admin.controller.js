import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import Department from '../models/Department.js';
import TaskCategory from '../models/TaskCategory.js';
import AcademicSession from '../models/AcademicSession.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate } from '../utils/http.js';
import { deptScope } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

// ---------- Roles & permissions ----------
export const listRoles = asyncHandler(async (_req, res) => ok(res, await Role.find().sort('name').lean()));
export const listPermissions = asyncHandler(async (_req, res) => ok(res, await Permission.find().sort('group key').lean()));

export const createRole = asyncHandler(async (req, res) => {
  if (req.body.permissions.includes('*')) throw ApiError.forbidden('Wildcard permission is reserved');
  const role = await Role.create(req.body);
  audit(req, { action: 'role.create', entityType: 'Role', entityId: role._id, after: req.body });
  created(res, role);
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.key === 'super_admin') throw ApiError.forbidden('Super admin role is immutable');
  if (req.body.permissions?.includes('*')) throw ApiError.forbidden('Wildcard permission is reserved');
  const before = role.toObject();
  Object.assign(role, req.body);
  await role.save();
  audit(req, { action: 'role.update', entityType: 'Role', entityId: role._id, before: { permissions: before.permissions }, after: req.body });
  ok(res, role);
});

export const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.forbidden('System roles cannot be deleted');
  const inUse = await User.countDocuments({ roles: role._id });
  if (inUse) throw ApiError.conflict(`Role is assigned to ${inUse} user(s)`);
  await role.deleteOne();
  audit(req, { action: 'role.delete', entityType: 'Role', entityId: role._id });
  ok(res, { deleted: true });
});

// ---------- Departments ----------
export const listDepartments = asyncHandler(async (req, res) => {
  const filter = req.isSuperAdmin ? {} : { _id: req.departmentId };
  ok(res, await Department.find(filter).populate('chairman', 'name email').sort('name').lean());
});

export const createDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  audit(req, { action: 'department.create', entityType: 'Department', entityId: dept._id, after: req.body });
  created(res, dept);
});

export const updateDepartment = asyncHandler(async (req, res) => {
  if (!req.isSuperAdmin && String(req.params.id) !== req.departmentId) throw ApiError.forbidden();
  const dept = await Department.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!dept) throw ApiError.notFound('Department not found');
  audit(req, { action: 'department.update', entityType: 'Department', entityId: dept._id, after: req.body });
  ok(res, dept);
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound('Department not found');
  const users = await User.countDocuments({ department: dept._id });
  if (users) throw ApiError.conflict(`Department has ${users} user(s)`);
  await dept.softDelete(req.user._id);
  audit(req, { action: 'department.delete', entityType: 'Department', entityId: dept._id });
  ok(res, { deleted: true });
});

// ---------- Task categories ----------
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const listCategories = asyncHandler(async (req, res) => {
  const filter = req.isSuperAdmin ? {} : { $or: [{ department: null }, { department: req.departmentId }] };
  ok(res, await TaskCategory.find(filter).sort('name').lean());
});

export const createCategory = asyncHandler(async (req, res) => {
  const cat = await TaskCategory.create({ ...req.body, slug: slugify(req.body.name), department: req.isSuperAdmin ? null : req.departmentId });
  audit(req, { action: 'category.create', entityType: 'TaskCategory', entityId: cat._id, after: req.body });
  created(res, cat);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const cat = await TaskCategory.findById(req.params.id);
  if (!cat) throw ApiError.notFound('Category not found');
  if (!req.isSuperAdmin && (cat.isDefault || String(cat.department) !== req.departmentId)) throw ApiError.forbidden('Cannot modify this category');
  Object.assign(cat, req.body, req.body.name ? { slug: slugify(req.body.name) } : {});
  await cat.save();
  ok(res, cat);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const cat = await TaskCategory.findById(req.params.id);
  if (!cat) throw ApiError.notFound('Category not found');
  if (cat.isDefault) throw ApiError.forbidden('Default categories cannot be deleted');
  if (!req.isSuperAdmin && String(cat.department) !== req.departmentId) throw ApiError.forbidden();
  await cat.softDelete(req.user._id);
  ok(res, { deleted: true });
});

// ---------- Academic sessions ----------
export const listSessions = asyncHandler(async (req, res) => {
  const filter = req.isSuperAdmin ? {} : { $or: [{ department: null }, { department: req.departmentId }] };
  ok(res, await AcademicSession.find(filter).sort('-startDate').lean());
});

export const createSession = asyncHandler(async (req, res) => {
  const department = req.isSuperAdmin ? null : req.departmentId;
  if (req.body.isCurrent) await AcademicSession.updateMany({ department }, { isCurrent: false });
  const s = await AcademicSession.create({ ...req.body, department });
  created(res, s);
});

export const updateSession = asyncHandler(async (req, res) => {
  const s = await AcademicSession.findById(req.params.id);
  if (!s) throw ApiError.notFound('Session not found');
  if (req.body.isCurrent) await AcademicSession.updateMany({ department: s.department, _id: { $ne: s._id } }, { isCurrent: false });
  Object.assign(s, req.body);
  await s.save();
  ok(res, s);
});

export const deleteSession = asyncHandler(async (req, res) => {
  await AcademicSession.deleteOne({ _id: req.params.id });
  ok(res, { deleted: true });
});

// ---------- Audit logs ----------
export const listAudit = asyncHandler(async (req, res) => {
  const { actor, action, entityType, from, to } = req.query;
  const filter = { ...deptScope(req) };
  if (actor) filter.actor = actor;
  if (action) filter.action = new RegExp(`^${action}`);
  if (entityType) filter.entityType = entityType;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const pg = parsePagination(req.query);
  const result = await paginate(AuditLog, filter, pg, [{ path: 'actor', select: 'name email avatar' }]);
  ok(res, result.items, result.meta);
});
