import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const taskAttachmentSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'Task', required: true, index: true },
    uploadedBy: { type: ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    path: { type: String, required: true }, // public URL path
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ['attachment', 'deliverable'], default: 'attachment' },
    version: { type: Number, default: 1 }, // deliverable versions
    approval: { type: ObjectId, ref: 'Approval', default: null },
  },
  { timestamps: true, toJSON: toJSONClean }
);

taskAttachmentSchema.plugin(softDelete);

export default mongoose.model('TaskAttachment', taskAttachmentSchema);
