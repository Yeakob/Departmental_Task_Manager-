import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('Role', roleSchema);
