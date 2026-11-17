import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: ObjectId, ref: 'User', index: true },
    department: { type: ObjectId, ref: 'Department', index: true },
    action: { type: String, required: true, index: true }, // e.g. task.create
    entityType: { type: String, index: true },
    entityId: { type: ObjectId, index: true },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: toJSONClean }
);

auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
