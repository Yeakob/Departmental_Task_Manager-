import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { softDelete, toJSONClean } from './plugins.js';

const refreshTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true },
    hash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: String,
    ip: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: null },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true }, // e.g., Professor, Lecturer, Office Assistant
    employeeId: { type: String, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true, default: null },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: Date,
    refreshTokens: { type: [refreshTokenSchema], select: false, default: [] },
    weeklyCapacityHours: { type: Number, default: 40, min: 0 }, // for workload management
  },
  { timestamps: true, toJSON: toJSONClean }
);

userSchema.plugin(softDelete);
userSchema.index({ department: 1, isActive: 1 });
userSchema.index({ name: 'text', email: 'text' });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model('User', userSchema);
