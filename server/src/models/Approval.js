import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';
import { APPROVAL_DECISIONS } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

/** One approval round per submission; history is the set of rounds for a task. */
const approvalSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'Task', required: true, index: true },
    round: { type: Number, default: 1 },
    submittedBy: { type: ObjectId, ref: 'User', required: true },
    submissionNote: String,
    deliverables: [{ type: ObjectId, ref: 'TaskAttachment' }],
    decision: { type: String, enum: APPROVAL_DECISIONS, default: 'pending', index: true },
    reviewer: { type: ObjectId, ref: 'User' },
    reviewerComment: String,
    decidedAt: Date,
  },
  { timestamps: true, toJSON: toJSONClean }
);

approvalSchema.index({ task: 1, round: -1 });

export default mongoose.model('Approval', approvalSchema);
