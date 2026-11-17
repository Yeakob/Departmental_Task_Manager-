import { z } from 'zod';
import { objectId, paginationQuery, csv } from './common.js';
import { TASK_STATUSES, PRIORITIES } from '../config/constants.js';

const assigneeInput = z.object({
  user: objectId,
  isPrimary: z.boolean().optional(),
  responsibility: z.string().trim().max(300).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(20000).optional().default(''),
  category: objectId.nullable().optional(),
  assignees: z.array(assigneeInput).optional().default([]),
  supporters: z.array(objectId).optional().default([]),
  committee: objectId.nullable().optional(),
  project: objectId.nullable().optional(),
  milestone: objectId.nullable().optional(),
  parentTask: objectId.nullable().optional(),
  dependsOn: z.array(objectId).optional(),
  priority: z.enum(PRIORITIES).optional().default('medium'),
  startDate: z.coerce.date().nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
  estimatedHours: z.number().min(0).max(10000).optional(),
  requiresApproval: z.boolean().optional(),
  approvers: z.array(objectId).optional(),
  watchers: z.array(objectId).optional(),
  tags: z.array(z.string().trim().max(30)).optional(),
  customFields: z.array(z.object({ key: z.string().max(50), label: z.string().max(100).optional(), value: z.any() })).optional(),
  checklist: z.array(z.string().trim().min(1).max(300)).optional(),
  isPersonal: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  templateName: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'assigned']).optional(),
});

export const updateTaskSchema = createTaskSchema
  .omit({ assignees: true, checklist: true, isPersonal: true, status: true })
  .partial()
  .extend({
    actualHours: z.number().min(0).max(10000).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  });

export const listTasksQuery = paginationQuery.extend({
  status: csv,
  priority: csv,
  category: csv,
  assignee: objectId.optional(),
  assignedBy: objectId.optional(),
  committee: objectId.optional(),
  project: objectId.optional(),
  parentTask: objectId.optional(),
  scope: z.enum(['all', 'mine', 'created', 'watching', 'approvals', 'overdue', 'upcoming']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  deadlineFrom: z.coerce.date().optional(),
  deadlineTo: z.coerce.date().optional(),
  overdue: z.enum(['true', 'false']).optional(),
  isTemplate: z.enum(['true', 'false']).optional(),
  tags: csv,
});

export const statusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  note: z.string().trim().max(1000).optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

export const assignSchema = z.object({
  assignees: z.array(assigneeInput).min(1),
  mode: z.enum(['replace', 'add']).optional().default('replace'),
  note: z.string().trim().max(500).optional(),
  deadline: z.coerce.date().optional(),
});

export const delegateSchema = z.object({
  to: objectId,
  note: z.string().trim().max(500).optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  parent: objectId.nullable().optional(),
  mentions: z.array(objectId).optional(),
});

export const checklistItemSchema = z.object({ text: z.string().trim().min(1).max(300) });
export const checklistToggleSchema = z.object({ done: z.boolean() });
export const checklistReorderSchema = z.object({ order: z.array(objectId) });

export const submitSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  attachmentIds: z.array(objectId).optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'revision_requested']),
  comment: z.string().trim().max(2000).optional(),
});

export const extensionRequestSchema = z.object({
  requestedDeadline: z.coerce.date(),
  reason: z.string().trim().min(5).max(1000),
});

export const extensionDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional(),
});

export const progressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  actualHours: z.number().min(0).optional(),
});

export const kanbanMoveSchema = z.object({
  status: z.enum(TASK_STATUSES),
  orderedIds: z.array(objectId).optional(), // new order within destination column
});

export const bulkCreateSchema = z.object({ tasks: z.array(createTaskSchema).min(1).max(50) });
export const bulkAssignSchema = z.object({ taskIds: z.array(objectId).min(1).max(100), assignees: z.array(assigneeInput).min(1), mode: z.enum(['replace', 'add']).optional() });
export const bulkStatusSchema = z.object({ taskIds: z.array(objectId).min(1).max(100), status: z.enum(TASK_STATUSES) });

export const watchSchema = z.object({ watch: z.boolean() });

export const dependencySchema = z.object({ dependsOn: objectId });
