import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

export const SHAPES = ['box', 'square', 'circle', 'diamond', 'other', 'cad'];

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    shape: { type: String, enum: SHAPES, default: 'box' },
    // Only the fields the shape needs, as the user typed them (in `unit`).
    // box/other: length,width,height | square: side,height | circle: diameter,height | diamond: diagonal1,diagonal2,thickness
    dims: { type: Map, of: Number, default: {} },
    unit: { type: String, enum: ['mm', 'cm', 'in'], default: 'mm' },
    weight: { type: Number, required: true, min: 0 },
    weightUnit: { type: String, enum: ['kg', 'lb'], default: 'kg' },
    clearanceMm: { type: Number, default: 0, min: 0 },
    upright: { type: Boolean, default: false },
    // Calculated by the engine on save (always mm / kg)
    box: { l: Number, w: Number, h: Number },
    weightKg: Number,
    color: { type: String, default: null },
    // Phase 2: uploaded CAD file (shape = 'cad'). Files live in STORAGE_DIR/<orgId>/<partId>/
    volumeMm3: { type: Number, default: null },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', default: null },
    weightSource: { type: String, enum: ['manual', 'material'], default: 'manual' },
    cad: {
      fileName: String,
      format: String,
      sizeBytes: Number,
      sourceFile: String,
      modelFile: String,
      solids: Number,
      areaMm2: Number,
      triangles: Number,
      watertight: Boolean,
      orientation: String,
      uploadedAt: Date
    }
  },
  { timestamps: true }
);

partSchema.plugin(tenantPlugin);
partSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.model('Part', partSchema);
