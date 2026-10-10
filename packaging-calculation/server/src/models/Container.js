import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// orgId = null means a standard template every customer can use (read-only).
const containerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    innerL: { type: Number, required: true, min: 1 },
    innerW: { type: Number, required: true, min: 1 },
    innerH: { type: Number, required: true, min: 1 },
    payloadKg: { type: Number, required: true, min: 0 },
    freightCost: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

containerSchema.plugin(tenantPlugin, { shared: true });

export default mongoose.model('Container', containerSchema);
