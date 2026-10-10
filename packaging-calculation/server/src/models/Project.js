import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// A customer's project (e.g. a product line or an order) that groups parts.
const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 1000 }
  },
  { timestamps: true }
);

projectSchema.plugin(tenantPlugin);
projectSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.model('Project', projectSchema);
