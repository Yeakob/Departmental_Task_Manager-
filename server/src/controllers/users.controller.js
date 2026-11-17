import crypto from 'crypto';
import User from '../models/User.js';
import Role from '../models/Role.js';
import UserPreference from '../models/UserPreference.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { deptScope, hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { sendEmail } from '../services/email.service.js';

const USER_SELECT = 'name email avatar phone designation employeeId department roles isActive lastLoginAt weeklyCapacityHours createdAt';

async function resolveRoles(keys, req) {
  const roles = await Role.find({ key: { $in: keys } });
  if (roles.length !== keys.length) throw ApiError.badRequest('One or more roles are invalid');
  if (!req.isSuperAdmin && roles.some((r) => r.key === 'super_admin')) throw ApiError.forbidden('Only a super admin can grant super admin');
  return roles.map((r) => r._id);
}

export const list = asyncHandler(async (req, res) => {
  const { q, department, role, isActive, ids } = req.query;
  const filter = { ...deptScope(req) };
  if (req.isSuperAdmin && department) filter.department = department;
  if (isActive) filter.isActive = isActive === 'true';
  if (ids?.length) filter._id = { $in: ids };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { designation: rx }, { employeeId: rx }];
  }
  if (role) {
    const r = await Role.findOne({ key: role }).select('_id');
    filter.roles = r ? r._id : null;
  }
  const pg = parsePagination(req.query, { defaultSort: 'name' });
  const result = await paginate(User, filter, pg, [{ path: 'roles', select: 'key name' }, { path: 'department', select: 'name code' }], USER_SELECT);
  ok(res, result.items, result.meta);
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...deptScope(req) }).select(USER_SELECT).populate('roles', 'key name permissions').populate('department', 'name code').lean();
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user);
});

export const create = asyncHandler(async (req, res) => {
  const { roles: roleKeys, password, ...data } = req.body;
  if (!req.isSuperAdmin) data.department = req.departmentId; // admins can only create in their own department
  const exists = await User.findOne({ email: data.email }).setOptions({ withDeleted: true });
  if (exists) throw ApiError.conflict('Email already registered');

  const roleIds = await resolveRoles(roleKeys, req);
  const tempPassword = password || `Dw${crypto.randomBytes(5).toString('base64url')}1!`;
  const user = new User({ ...data, roles: roleIds, mustChangePassword: !password });
  await user.setPassword(tempPassword);
  await user.save();
  await UserPreference.create({ user: user._id });

  sendEmail({
    to: user.email,
    subject: 'Your DWMT account',
    title: `Welcome to DWMT, ${user.name}`,
    body: `An account has been created for you.<br/>Email: <b>${user.email}</b><br/>Temporary password: <b>${tempPassword}</b><br/>You will be asked to change it on first login.`,
    actionPath: '/login',
    actionLabel: 'Sign in',
  });

  audit(req, { action: 'user.create', entityType: 'User', entityId: user._id, after: { email: user.email, roles: roleKeys } });
  const out = await User.findById(user._id).select(USER_SELECT).populate('roles', 'key name').lean();
  created(res, { ...out, ...(password ? {} : { temporaryPassword: tempPassword }) });
});

export const update = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...deptScope(req) });
  if (!user) throw ApiError.notFound('User not found');
  const before = { roles: user.roles, isActive: user.isActive, department: user.department };
  const { roles: roleKeys, ...data } = req.body;
  if (roleKeys) user.roles = await resolveRoles(roleKeys, req);
  if (!req.isSuperAdmin) delete data.department;
  Object.assign(user, data);
  if (data.isActive === false) user.refreshTokens = [];
  await user.save();
  audit(req, { action: 'user.update', entityType: 'User', entityId: user._id, before, after: req.body });
  const out = await User.findById(user._id).select(USER_SELECT).populate('roles', 'key name').populate('department', 'name code').lean();
  ok(res, out);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...deptScope(req) }).select('+passwordHash +refreshTokens');
  if (!user) throw ApiError.notFound('User not found');
  await user.setPassword(req.body.password);
  user.mustChangePassword = true;
  user.refreshTokens = [];
  await user.save();
  audit(req, { action: 'user.reset_password', entityType: 'User', entityId: user._id });
  ok(res, { reset: true });
});

export const remove = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...deptScope(req) });
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot delete your own account');
  user.isActive = false;
  await user.softDelete(req.user._id);
  audit(req, { action: 'user.delete', entityType: 'User', entityId: user._id });
  ok(res, { deleted: true });
});

/** Lightweight directory for pickers (assignees, members). Any authenticated user. */
export const directory = asyncHandler(async (req, res) => {
  const filter = { isActive: true, ...deptScope(req) };
  if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
  const users = await User.find(filter).select('name email avatar designation roles').populate('roles', 'key name').sort('name').limit(200).lean();
  ok(res, users);
});

export const preferences = asyncHandler(async (req, res) => {
  const pref = await UserPreference.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id } }, { new: true, upsert: true }).lean();
  ok(res, pref);
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const allowed = ['theme', 'language', 'notifications', 'sidebarCollapsed', 'savedFilters', 'recentSearches'];
  const $set = {};
  for (const k of allowed) if (req.body[k] !== undefined) $set[k] = req.body[k];
  const pref = await UserPreference.findOneAndUpdate({ user: req.user._id }, { $set }, { new: true, upsert: true }).lean();
  ok(res, pref);
});

export { hasPermission };
