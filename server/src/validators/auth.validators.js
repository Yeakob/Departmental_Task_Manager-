import { z } from 'zod';
import { passwordSchema, objectId } from './common.js';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

/** Registration is admin-driven (users are created by admins), but kept for completeness / bootstrap. */
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  department: objectId.optional(),
  designation: z.string().trim().max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  designation: z.string().trim().max(100).optional(),
});
