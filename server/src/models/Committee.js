import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const memberSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['coordinator', 'member', 'secretary'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const committeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    coordinator: { type: ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    responsibilities: [{ type: String, trim: true }],
    meetingSchedule: { type: String, trim: true }, // e.g. "First Sunday of each month"
    documents: [{ type: ObjectId, ref: 'Document' }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: toJSONClean }
);

committeeSchema.plugin(softDelete);
committeeSchema.index({ name: 'text', description: 'text' });
committeeSchema.index({ 'members.user': 1 });

export default mongoose.model('Committee', committeeSchema);
