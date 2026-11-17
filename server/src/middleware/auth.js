import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { asyncHandler } from '../utils/http.js';

/**
 * Authenticates via Bearer access token. Attaches:
 *  req.user          — lean user with populated roles
 *  req.permissions   — Set of permission keys (union of all roles)
 *  req.departmentId  — string | null
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).populate('roles', 'key name permissions').lean();
  if (!user || !user.isActive || user.deletedAt) throw ApiError.unauthorized('Account not available');

  const permissions = new Set();
  for (const role of user.roles || []) for (const p of role.permissions || []) permissions.add(p);

  req.user = user;
  req.permissions = permissions;
  req.roleKeys = (user.roles || []).map((r) => r.key);
  req.isSuperAdmin = permissions.has('*');
  req.departmentId = user.department ? String(user.department) : null;
  next();
});

export function hasPermission(req, ...required) {
  if (req.isSuperAdmin) return true;
  return required.some((p) => req.permissions.has(p));
}

/** Authorizes if the user holds ANY of the listed permissions. */
export const authorize = (...required) => (req, _res, next) => {
  if (hasPermission(req, ...required)) return next();
  next(ApiError.forbidden('You do not have permission to perform this action'));
};

/** Builds a department scope filter: super admin sees all, others only their department. */
export function deptScope(req, field = 'department') {
  if (req.isSuperAdmin) return {};
  if (!req.departmentId) return { [field]: null };
  return { [field]: req.departmentId };
}
