import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), dept: user.department ? String(user.department) : null }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

/** Refresh tokens are opaque random strings; only their hash is stored (rotation-safe). */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('hex');
  const jti = crypto.randomUUID();
  const token = jwt.sign({ jti, raw }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });
  return { token, jti, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

export function refreshCookieOptions() {
  const days = parseInt(env.jwt.refreshExpires, 10) || 7;
  return {
    httpOnly: true,
    secure: env.cookieSecure || env.isProd,
    sameSite: env.isProd ? 'strict' : 'lax',
    path: '/api/v1/auth',
    maxAge: days * 24 * 60 * 60 * 1000,
  };
}
