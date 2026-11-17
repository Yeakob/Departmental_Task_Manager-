import { z } from 'zod';
import mongoose from 'mongoose';

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), { message: 'Invalid id' });
export const objectIdParam = z.object({ id: objectId });
export const optionalObjectId = objectId.nullable().optional();

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
});

export const dateString = z.coerce.date();

/** Accepts a comma-separated string or array and returns an array of strings. */
export const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v == null ? undefined : Array.isArray(v) ? v : v.split(',').map((s) => s.trim()).filter(Boolean)));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a digit');
