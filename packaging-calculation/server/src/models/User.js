import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

export const ROLES = ['owner', 'planner', 'viewer'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'planner' },
    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.plugin(tenantPlugin);
// Email is unique across the whole platform so login needs no company code.
userSchema.index({ email: 1 }, { unique: true });

export default mongoose.model('User', userSchema);
