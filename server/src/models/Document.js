import mongoose from 'mongoose';
import { softDelete, toJSONClean } from './plugins.js';
import { DOCUMENT_CATEGORIES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const versionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    fileName: String,
    path: String,
    mimeType: String,
    size: Number,
    uploadedBy: { type: ObjectId, ref: 'User' },
    note: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: String,
    category: { type: String, enum: DOCUMENT_CATEGORIES, default: 'Other', index: true },
    department: { type: ObjectId, ref: 'Department', required: true, index: true },
    uploadedBy: { type: ObjectId, ref: 'User', required: true },
    currentVersion: { type: Number, default: 1 },
    versions: { type: [versionSchema], default: [] },
    tags: [{ type: String, lowercase: true, trim: true }],
    task: { type: ObjectId, ref: 'Task', default: null, index: true },
    project: { type: ObjectId, ref: 'Project', default: null, index: true },
    committee: { type: ObjectId, ref: 'Committee', default: null, index: true },
    meeting: { type: ObjectId, ref: 'Meeting', default: null },
    visibility: { type: String, enum: ['department', 'restricted'], default: 'department' },
    allowedUsers: [{ type: ObjectId, ref: 'User' }], // when restricted
    allowedRoles: [{ type: String }],
  },
  { timestamps: true, toJSON: toJSONClean }
);

documentSchema.plugin(softDelete);
documentSchema.index({ title: 'text', description: 'text', tags: 'text' });

documentSchema.virtual('latest').get(function () {
  return this.versions.find((v) => v.version === this.currentVersion) || this.versions[this.versions.length - 1];
});

export default mongoose.model('Document', documentSchema);
