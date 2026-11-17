import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const itemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    done: { type: Boolean, default: false },
    doneBy: { type: ObjectId, ref: 'User' },
    doneAt: Date,
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const taskChecklistSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'Task', required: true, unique: true },
    title: { type: String, default: 'Checklist' },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true, toJSON: toJSONClean }
);

taskChecklistSchema.virtual('completion').get(function () {
  if (!this.items.length) return 0;
  return Math.round((this.items.filter((i) => i.done).length / this.items.length) * 100);
});

export default mongoose.model('TaskChecklist', taskChecklistSchema);
