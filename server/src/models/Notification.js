import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: ObjectId, ref: 'User', required: true, index: true },
    actor: { type: ObjectId, ref: 'User' },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String },
    entityType: { type: String, enum: ['task', 'project', 'meeting', 'committee', 'announcement', 'document'] },
    entityId: { type: ObjectId },
    link: String,
    readAt: { type: Date, default: null },
    dedupeKey: { type: String }, // set only for reminders; absent otherwise
    emailedAt: Date,
  },
  { timestamps: true, toJSON: toJSONClean }
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
// Partial (not sparse): a sparse index still indexes explicit nulls, which made every
// un-keyed notification after the first collide. Only real string keys are unique.
notificationSchema.index({ dedupeKey: 1 }, { name: 'dedupeKey_unique', unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export default mongoose.model('Notification', notificationSchema);
