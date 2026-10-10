import mongoose from 'mongoose'

const cartonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dimensions: { length: { type: Number, required: true }, width: { type: Number, required: true }, height: { type: Number, required: true }, unit: { type: String, default: 'mm' } },
    maxWeightKg: { type: Number, min: 0 },
    cost: { type: Number, min: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('Carton', cartonSchema)