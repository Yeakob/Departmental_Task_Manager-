import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';
import { TASK_STATUSES, PRIORITIES, OPEN_STATUSES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const assigneeSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    isPrimary: { type: Boolean, default: false },
    responsibility: { type: String, trim: true }, // individual responsibility note
    acknowledgedAt: Date,
  },
  { _id: false }
);

const assignmentHistorySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['assigned', 'reassigned', 'delegated', 'unassigned'], required: true },
    by: { type: ObjectId, ref: 'User' },
    from: [{ type: ObjectId, ref: 'User' }],
    to: [{ type: ObjectId, ref: 'User' }],
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const extensionRequestSchema = new mongoose.Schema(
  {
    requestedBy: { type: ObjectId, ref: 'User', required: true },
    requestedDeadline: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decidedBy: { type: ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNote: String,
  },
  { timestamps: true }
);

const customFieldSchema = new mongoose.Schema(
  { key: { type: String, required: true }, label: String, value: mongoose.Schema.Types.Mixed },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, unique: true }, // e.g. CSE-0042
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '' }, // rich text (HTML from TipTap, sanitized)
    category: { type: ObjectId, ref: 'TaskCategory', index: true },
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    assignedBy: { type: ObjectId, ref: 'User', required: true, index: true },
    assignees: { type: [assigneeSchema], default: [] },
    supporters: [{ type: ObjectId, ref: 'User' }],
    committee: { type: ObjectId, ref: 'Committee', default: null, index: true },
    project: { type: ObjectId, ref: 'Project', default: null, index: true },
    milestone: { type: ObjectId, ref: 'ProjectMilestone', default: null },
    parentTask: { type: ObjectId, ref: 'Task', default: null, index: true },
    dependsOn: [{ type: ObjectId, ref: 'Task' }],
    priority: { type: String, enum: PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'draft', index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    startDate: Date,
    deadline: { type: Date, index: true },
    estimatedHours: { type: Number, min: 0, default: 0 },
    actualHours: { type: Number, min: 0, default: 0 },
    requiresApproval: { type: Boolean, default: true },
    approvers: [{ type: ObjectId, ref: 'User' }],
    watchers: [{ type: ObjectId, ref: 'User' }],
    tags: [{ type: String, trim: true, lowercase: true }],
    assignmentHistory: { type: [assignmentHistorySchema], default: [] },
    extensionRequests: { type: [extensionRequestSchema], default: [] },
    customFields: { type: [customFieldSchema], default: [] },
    isPersonal: { type: Boolean, default: false }, // created by a user for themselves
    isTemplate: { type: Boolean, default: false },
    templateName: String,
    recurringTask: { type: ObjectId, ref: 'RecurringTask', default: null },
    completedAt: Date,
    submittedAt: Date,
    lastReminderOffset: { type: Number, default: null }, // minutes; prevents duplicate reminders
    overdueNotifiedAt: Date,
    kanbanOrder: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: toJSONClean, toObject: { virtuals: true } }
);

taskSchema.plugin(softDelete);

taskSchema.index({ title: 'text', description: 'text', taskId: 'text', tags: 'text' });
taskSchema.index({ department: 1, status: 1, deadline: 1 });
taskSchema.index({ 'assignees.user': 1, status: 1 });
taskSchema.index({ department: 1, createdAt: -1 });

taskSchema.virtual('isOverdue').get(function () {
  return Boolean(this.deadline && OPEN_STATUSES.includes(this.status) && this.deadline < new Date());
});

taskSchema.virtual('primaryAssignee').get(function () {
  const p = (this.assignees || []).find((a) => a.isPrimary) || (this.assignees || [])[0];
  return p ? p.user : null;
});

export default mongoose.model('Task', taskSchema);
