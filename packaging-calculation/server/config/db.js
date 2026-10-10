import mongoose from 'mongoose'

const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/packaging-solution'

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection

  await mongoose.connect(mongoUrl)
  await mongoose.connection.createCollection('companies')
  console.log('MongoDB connected')
  return mongoose.connection
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
