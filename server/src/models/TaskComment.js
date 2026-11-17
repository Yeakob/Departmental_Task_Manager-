import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const taskCommentSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'Task', required: true, index: true },
    author: { type: ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 5000 },
    parent: { type: ObjectId, ref: 'TaskComment', default: null }, // threaded discussions
    mentions: [{ type: ObjectId, ref: 'User' }],
    attachments: [{ type: ObjectId, ref: 'TaskAttachment' }],
    editedAt: Date,
  },
  { timestamps: true, toJSON: toJSONClean }
);

taskCommentSchema.plugin(softDelete);
taskCommentSchema.index({ task: 1, createdAt: 1 });

export default mongoose.model('TaskComment', taskCommentSchema);
