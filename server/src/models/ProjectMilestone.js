import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const milestoneSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: String,
    dueDate: Date,
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    completedAt: Date,
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('ProjectMilestone', milestoneSchema);
