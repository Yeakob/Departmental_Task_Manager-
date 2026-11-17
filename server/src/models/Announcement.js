import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true },
    department: { type: ObjectId, ref: 'Department', default: null, index: true }, // null = system-wide
    author: { type: ObjectId, ref: 'User', required: true },
    isPinned: { type: Boolean, default: false },
    priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
    audienceRoles: [{ type: String }], // empty = everyone in department
    publishAt: { type: Date, default: Date.now },
    expiresAt: Date,
    attachments: [{ type: ObjectId, ref: 'Document' }],
  },
  { timestamps: true, toJSON: toJSONClean }
);

announcementSchema.plugin(softDelete);
announcementSchema.index({ department: 1, isPinned: -1, publishAt: -1 });

export default mongoose.model('Announcement', announcementSchema);
