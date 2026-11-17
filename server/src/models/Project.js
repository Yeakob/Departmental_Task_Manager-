import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';
import { PROJECT_STATUSES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, trim: true },
    description: { type: String, default: '' },
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    manager: { type: ObjectId, ref: 'User', required: true },
    members: [{ type: ObjectId, ref: 'User' }],
    status: { type: String, enum: PROJECT_STATUSES, default: 'planning', index: true },
    startDate: Date,
    endDate: Date,
    budget: { amount: { type: Number, min: 0 }, currency: { type: String, default: 'BDT' } },
    documents: [{ type: ObjectId, ref: 'Document' }],
    archivedAt: Date,
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: toJSONClean }
);

projectSchema.plugin(softDelete);
projectSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Project', projectSchema);
