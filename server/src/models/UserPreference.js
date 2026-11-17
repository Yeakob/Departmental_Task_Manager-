import mongoose from 'mongoose';
import { toJSONClean } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const userPreferenceSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, unique: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    language: { type: String, enum: ['en', 'bn'], default: 'en' },
    notifications: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: false },
      mutedTypes: { type: [String], default: [] },
    },
    savedFilters: [{ name: String, scope: String, query: mongoose.Schema.Types.Mixed, createdAt: { type: Date, default: Date.now } }],
    recentSearches: { type: [String], default: [] },
    sidebarCollapsed: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: toJSONClean }
);

export default mongoose.model('UserPreference', userPreferenceSchema);
