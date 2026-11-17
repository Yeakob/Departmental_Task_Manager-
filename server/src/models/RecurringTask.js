import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';
import { PRIORITIES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const recurringTaskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    template: {
      title: { type: String, required: true },
      description: String,
      category: { type: ObjectId, ref: 'TaskCategory' },
      priority: { type: String, enum: PRIORITIES, default: 'medium' },
      assignees: [{ type: ObjectId, ref: 'User' }],
      committee: { type: ObjectId, ref: 'Committee' },
      project: { type: ObjectId, ref: 'Project' },
      estimatedHours: Number,
      requiresApproval: { type: Boolean, default: true },
      durationDays: { type: Number, default: 7 }, // deadline = occurrence date + duration
    },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'semester', 'annually'], required: true },
    dayOfWeek: Number, // weekly
    dayOfMonth: Number, // monthly / annually
    month: Number, // annually
    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: Date,
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('RecurringTask', recurringTaskSchema);
