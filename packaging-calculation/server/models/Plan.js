import mongoose from 'mongoose'

const planSchema = new mongoose.Schema({ name: { type: String, required: true }, parts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Part' }], result: mongoose.Schema.Types.Mixed, goal: { type: String, enum: ['cost', 'space', 'containers'], default: 'space' } }, { timestamps: true })

export default mongoose.model('Plan', planSchema)