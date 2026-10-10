import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// orgId = null means a standard template every customer can use (read-only).
const palletSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    L: { type: Number, required: true, min: 1 },
    W: { type: Number, required: true, min: 1 },
    deckH: { type: Number, default: 150, min: 0 },
    maxStackH: { type: Number, default: 1800, min: 1 }, // total height incl. deck
    maxLoadKg: { type: Number, default: 1000, min: 0 }, // cargo on the pallet
    weightKg: { type: Number, default: 25, min: 0 },
    isFloorLoad: { type: Boolean, default: false } // "No pallet": cartons straight on the container floor
  },
  { timestamps: true }
);

palletSchema.plugin(tenantPlugin, { shared: true });

export default mongoose.model('Pallet', palletSchema);
