import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, unique: true }, // e.g. CSE
    faculty: { type: String, trim: true }, // e.g. Faculty of Science & Engineering
    chairman: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: String,
    settings: {
      taskIdPrefix: { type: String, default: null }, // falls back to code
      reminderOffsetsMinutes: { type: [Number], default: [10080, 4320, 1440, 60] },
      workingDays: { type: [Number], default: [0, 1, 2, 3, 4] }, // Sun-Thu (Bangladesh)
    },
  },
  { timestamps: true, toJSON: toJSONClean }
);

departmentSchema.plugin(softDelete);

export default mongoose.model('Department', departmentSchema);
