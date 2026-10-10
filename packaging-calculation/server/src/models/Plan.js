import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// A saved load plan. Inputs AND the engine result are frozen at save time,
// so the plan stays the same even if parts or cartons are edited later.
const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    goal: { type: String, enum: ['cost', 'containers', 'cartons', 'space'], default: 'cost' },
    inputs: { type: mongoose.Schema.Types.Mixed, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    // Read-only link for the warehouse phone view (no login needed)
    shareToken: { type: String, default: null },
    shareExpiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

planSchema.plugin(tenantPlugin);
planSchema.index({ shareToken: 1 }, { unique: true, partialFilterExpression: { shareToken: { $type: 'string' } } });
planSchema.index({ orgId: 1, createdAt: -1 });

export default mongoose.model('Plan', planSchema);
