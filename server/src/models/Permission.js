import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

/** Catalogue of permission keys with human-readable grouping; seeded from constants. */
const permissionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    group: { type: String, required: true }, // e.g. "task"
    description: { type: String },
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('Permission', permissionSchema);
