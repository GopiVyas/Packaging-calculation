import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// All sizes in mm, weights in kg.
const cartonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    innerL: { type: Number, required: true, min: 1 },
    innerW: { type: Number, required: true, min: 1 },
    innerH: { type: Number, required: true, min: 1 },
    wallMm: { type: Number, default: 5, min: 0 },
    maxWeightKg: { type: Number, required: true, min: 0 },
    emptyWeightKg: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    isSuggested: { type: Boolean, default: false },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

cartonSchema.plugin(tenantPlugin);
cartonSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.model('Carton', cartonSchema);
