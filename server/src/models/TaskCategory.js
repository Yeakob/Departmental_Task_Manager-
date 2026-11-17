import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const taskCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    color: { type: String, default: '#6366f1' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null }, // null = global
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: toJSONClean }
);

taskCategorySchema.plugin(softDelete);
taskCategorySchema.index({ slug: 1, department: 1 }, { unique: true });

export default mongoose.model('TaskCategory', taskCategorySchema);
