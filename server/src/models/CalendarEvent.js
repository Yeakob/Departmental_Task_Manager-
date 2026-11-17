import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

/** Free-standing calendar entries: exams, seminars, departmental events, academic milestones, holidays. */
const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: String,
    type: { type: String, enum: ['exam', 'event', 'seminar', 'workshop', 'academic', 'holiday', 'other'], default: 'event', index: true },
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: String,
    color: String,
    committee: { type: ObjectId, ref: 'Committee', default: null },
    project: { type: ObjectId, ref: 'Project', default: null },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: toJSONClean }
);

calendarEventSchema.plugin(softDelete);
calendarEventSchema.index({ department: 1, startAt: 1 });

export default mongoose.model('CalendarEvent', calendarEventSchema);
