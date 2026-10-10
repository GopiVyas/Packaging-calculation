import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// Weight = volume × density. orgId = null: standard materials everyone can use.
const materialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    densityGcm3: { type: Number, required: true, min: 0.01, max: 30 }
  },
  { timestamps: true }
);

materialSchema.plugin(tenantPlugin, { shared: true });

export default mongoose.model('Material', materialSchema);
