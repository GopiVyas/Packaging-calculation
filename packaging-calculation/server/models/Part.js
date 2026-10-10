import mongoose from 'mongoose'

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    dimensions: {
      length: { type: Number, required: true, min: 0 },
      width: { type: Number, required: true, min: 0 },
      height: { type: Number, required: true, min: 0 },
      unit: { type: String, enum: ['mm', 'cm', 'in'], default: 'mm' },
    },
    weight: { value: { type: Number, min: 0 }, unit: { type: String, enum: ['kg', 'lb'], default: 'kg' } },
    shape: { type: String, enum: ['box', 'cylinder', 'sphere'], default: 'box' },
  },
  { timestamps: true },
)

export default mongoose.model('Part', partSchema)