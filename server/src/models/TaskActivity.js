import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

/** Immutable per-task activity timeline (status changes, assignments, comments, uploads...). */
const taskActivitySchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'Task', required: true, index: true },
    actor: { type: ObjectId, ref: 'User' },
    type: {
      type: String,
      required: true,
      enum: [
        'created', 'updated', 'status_changed', 'assigned', 'reassigned', 'delegated', 'commented',
        'attachment_added', 'attachment_removed', 'submitted', 'approved', 'rejected', 'revision_requested',
        'extension_requested', 'extension_decided', 'checklist_updated', 'progress_updated', 'watcher_added',
        'subtask_added', 'dependency_added', 'deleted', 'restored',
      ],
    },
    message: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: toJSONClean }
);

taskActivitySchema.index({ task: 1, createdAt: -1 });

export default mongoose.model('TaskActivity', taskActivitySchema);
