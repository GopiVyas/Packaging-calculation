import mongoose from 'mongoose'

const containerSchema = new mongoose.Schema({ name: { type: String, required: true }, dimensions: { length: Number, width: Number, height: Number, unit: { type: String, default: 'mm' } }, maxWeightKg: Number }, { timestamps: true })

export default mongoose.model('Container', containerSchema)