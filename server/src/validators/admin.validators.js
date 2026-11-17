import { z } from 'zod';
import { objectId, paginationQuery, passwordSchema, csv } from './common.js';
import { PERMISSIONS } from '../config/constants.js';

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().toLowerCase(),
  password: passwordSchema.optional(),
  department: objectId.nullable().optional(),
  roles: z.array(z.string()).min(1), // role keys
  designation: z.string().trim().max(100).optional(),
  employeeId: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const listUsersQuery = paginationQuery.extend({
  department: objectId.optional(),
  role: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  ids: csv,
});

export const roleSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).min(2).max(50),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.enum([...PERMISSIONS, '*'])),
});
export const updateRoleSchema = roleSchema.partial().omit({ key: true });

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().min(2).max(10),
  faculty: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  chairman: objectId.nullable().optional(),
  settings: z
    .object({
      taskIdPrefix: z.string().trim().max(10).nullable().optional(),
      reminderOffsetsMinutes: z.array(z.number().int().positive()).optional(),
      workingDays: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
});
export const updateDepartmentSchema = departmentSchema.partial();

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const academicSessionSchema = z.object({
  name: z.string().trim().min(2).max(60),
  semester: z.enum(['spring', 'summer', 'fall', 'other']).optional(),
  year: z.number().int().min(2000).max(2100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
});

export const auditQuery = paginationQuery.extend({
  actor: objectId.optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
