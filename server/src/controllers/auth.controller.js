import * as authService from '../services/auth.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';
import { refreshCookieOptions } from '../utils/tokens.js';
import { audit } from '../middleware/audit.js';
import User from '../models/User.js';

const REFRESH_COOKIE = 'dwmt_rt';
const meta = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

export const login = asyncHandler(async (req, res) => {
  const { refreshToken, ...data } = await authService.login(req.body, meta(req));
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  req.user = { _id: data.user.id, department: data.user.department?._id };
  audit(req, { action: 'auth.login', entityType: 'User', entityId: data.user.id });
  ok(res, data);
});

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  created(res, { id: user.id, email: user.email, name: user.name });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken, ...data } = await authService.refresh(req.cookies?.[REFRESH_COOKIE], meta(req));
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  ok(res, data);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
  ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const payload = await authService.buildAuthPayload(req.user);
  ok(res, payload);
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
  audit(req, { action: 'auth.change_password', entityType: 'User', entityId: req.user._id });
  ok(res, { changed: true });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true, runValidators: true });
  const payload = await authService.buildAuthPayload(user);
  ok(res, payload);
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) return ok(res, { avatar: null });
  const { toPublicPath } = await import('../middleware/upload.js');
  const avatar = toPublicPath(req.file.path);
  await User.updateOne({ _id: req.user._id }, { avatar });
  ok(res, { avatar });
});
