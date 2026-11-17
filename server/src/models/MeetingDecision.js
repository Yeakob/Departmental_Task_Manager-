import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

/** A decision taken in a meeting; may be converted into a Task for tracking. */
const meetingDecisionSchema = new mongoose.Schema(
  {
    meeting: { type: ObjectId, ref: 'Meeting', required: true, index: true },
    title: { type: String, required: true, trim: true },
    details: String,
    responsible: [{ type: ObjectId, ref: 'User' }],
    deadline: Date,
    status: { type: String, enum: ['open', 'in_progress', 'implemented', 'dropped'], default: 'open' },
    task: { type: ObjectId, ref: 'Task', default: null },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('MeetingDecision', meetingDecisionSchema);
