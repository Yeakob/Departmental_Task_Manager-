import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';
import { MEETING_STATUSES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const participantSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    attendance: { type: String, enum: ['invited', 'accepted', 'declined', 'present', 'absent'], default: 'invited' },
  },
  { _id: false }
);

const agendaItemSchema = new mongoose.Schema(
  { title: { type: String, required: true }, presenter: { type: ObjectId, ref: 'User' }, durationMinutes: Number, notes: String, order: Number },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    committee: { type: ObjectId, ref: 'Committee', default: null, index: true },
    project: { type: ObjectId, ref: 'Project', default: null },
    organizer: { type: ObjectId, ref: 'User', required: true },
    participants: { type: [participantSchema], default: [] },
    agenda: { type: [agendaItemSchema], default: [] },
    location: String,
    meetingLink: String,
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: MEETING_STATUSES, default: 'scheduled' },
    minutes: { type: ObjectId, ref: 'MeetingMinutes', default: null },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: toJSONClean }
);

meetingSchema.plugin(softDelete);
meetingSchema.index({ title: 'text', description: 'text' });
meetingSchema.index({ 'participants.user': 1, startAt: -1 });

export default mongoose.model('Meeting', meetingSchema);
