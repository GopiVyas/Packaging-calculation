import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDatabase } from './config/db.js'
import parts from './routes/parts.js'
import cartons from './routes/cartons.js'
import pallets from './routes/pallets.js'
import containers from './routes/containers.js'
import plans from './routes/plans.js'
import register from './routes/register.js'

const app = express()
const port = process.env.PORT || 3001
app.use(cors())
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api/parts', parts)
app.use('/api/cartons', cartons)
app.use('/api/pallets', pallets)
app.use('/api/containers', containers)
app.use('/api/plans', plans)
app.use('/api/register', register)
app.use((error, _request, response, _next) => response.status(400).json({ error: error.message }))

connectDatabase()
	.then(() => app.listen(port, () => console.log(`Packaging API listening on ${port}`)))
	.catch((error) => {
		console.error('MongoDB connection failed:', error.message)
		process.exitCode = 1
	})