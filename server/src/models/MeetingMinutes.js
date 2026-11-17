import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const meetingMinutesSchema = new mongoose.Schema(
  {
    meeting: { type: ObjectId, ref: 'Meeting', required: true, unique: true },
    body: { type: String, default: '' }, // rich text
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    attendees: [{ type: ObjectId, ref: 'User' }],
    absentees: [{ type: ObjectId, ref: 'User' }],
    document: { type: ObjectId, ref: 'Document', default: null }, // uploaded minutes file
    approvedBy: { type: ObjectId, ref: 'User' },
    approvedAt: Date,
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('MeetingMinutes', meetingMinutesSchema);
