import User from '../models/User.js';
import Role from '../models/Role.js';
import UserPreference from '../models/UserPreference.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken, generateRefreshToken, hashToken, verifyRefreshToken } from '../utils/tokens.js';
import { env } from '../config/env.js';

const MAX_SESSIONS = 5;

function refreshExpiryDate() {
  const days = parseInt(env.jwt.refreshExpires, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function buildAuthPayload(user) {
  const populated = await User.findById(user._id).populate('roles', 'key name permissions').populate('department', 'name code').lean();
  const permissions = new Set();
  for (const r of populated.roles || []) for (const p of r.permissions || []) permissions.add(p);
  return {
    user: {
      id: String(populated._id),
      name: populated.name,
      email: populated.email,
      avatar: populated.avatar,
      designation: populated.designation,
      phone: populated.phone,
      department: populated.department,
      roles: (populated.roles || []).map((r) => ({ key: r.key, name: r.name })),
      permissions: [...permissions],
      mustChangePassword: populated.mustChangePassword,
      weeklyCapacityHours: populated.weeklyCapacityHours,
    },
  };
}

export async function login({ email, password }, meta = {}) {
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokens');
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

  const { token: refreshToken, jti, hash } = generateRefreshToken();
  user.refreshTokens = [...(user.refreshTokens || []).filter((t) => t.expiresAt > new Date()).slice(-(MAX_SESSIONS - 1)), {
    jti, hash, expiresAt: refreshExpiryDate(), userAgent: meta.userAgent, ip: meta.ip,
  }];
  user.lastLoginAt = new Date();
  await user.save();
  await UserPreference.updateOne({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true });

  const accessToken = signAccessToken(user);
  const payload = await buildAuthPayload(user);
  return { ...payload, accessToken, refreshToken };
}

/** Rotates the refresh token: old one is revoked, new one issued. Reuse of a revoked token revokes all sessions. */
export async function refresh(oldToken, meta = {}) {
  if (!oldToken) throw ApiError.unauthorized('No refresh token');
  let payload;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const oldHash = hashToken(oldToken);
  const user = await User.findOne({ 'refreshTokens.jti': payload.jti }).select('+refreshTokens');
  if (!user) {
    // Token not found: possibly reused after rotation. Nothing more we can do safely.
    throw ApiError.unauthorized('Refresh token revoked');
  }
  const entry = user.refreshTokens.find((t) => t.jti === payload.jti);
  if (!entry || entry.hash !== oldHash || entry.expiresAt < new Date()) {
    // Reuse detected -> revoke everything for safety.
    user.refreshTokens = [];
    await user.save();
    throw ApiError.unauthorized('Refresh token reuse detected; please log in again');
  }
  if (!user.isActive) throw ApiError.forbidden('Account deactivated');

  const { token: refreshToken, jti, hash } = generateRefreshToken();
  user.refreshTokens = user.refreshTokens.filter((t) => t.jti !== payload.jti && t.expiresAt > new Date());
  user.refreshTokens.push({ jti, hash, expiresAt: refreshExpiryDate(), userAgent: meta.userAgent, ip: meta.ip });
  await user.save();

  const accessToken = signAccessToken(user);
  const authPayload = await buildAuthPayload(user);
  return { ...authPayload, accessToken, refreshToken };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.updateOne({ 'refreshTokens.jti': payload.jti }, { $pull: { refreshTokens: { jti: payload.jti } } });
  } catch {
    /* ignore invalid token on logout */
  }
}

export async function logoutAll(userId) {
  await User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
}

export async function register(data) {
  const exists = await User.findOne({ email: data.email }).setOptions({ withDeleted: true });
  if (exists) throw ApiError.conflict('Email already registered');
  const facultyRole = await Role.findOne({ key: 'faculty' });
  const user = new User({ name: data.name, email: data.email, department: data.department || null, designation: data.designation, roles: facultyRole ? [facultyRole._id] : [] });
  await user.setPassword(data.password);
  await user.save();
  return user;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  await user.setPassword(newPassword);
  user.mustChangePassword = false;
  user.refreshTokens = [];
  await user.save();
}
