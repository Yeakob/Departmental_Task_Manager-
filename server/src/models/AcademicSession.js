import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const academicSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Spring 2026"
    department: { type: ObjectId, ref: 'Department', default: null, index: true }, // null = institution-wide
    semester: { type: String, enum: ['spring', 'summer', 'fall', 'other'], default: 'other' },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: toJSONClean }
);

academicSessionSchema.index({ department: 1, isCurrent: 1 });

export default mongoose.model('AcademicSession', academicSessionSchema);
