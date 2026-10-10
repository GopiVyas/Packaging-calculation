import 'dotenv/config'
import Carton from './models/Carton.js'
import Pallet from './models/Pallet.js'
import Container from './models/Container.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'

await connectDatabase()
await Carton.deleteMany({})
await Pallet.deleteMany({})
await Container.deleteMany({})
await Carton.insertMany([{ name: 'Small carton', dimensions: { length: 300, width: 200, height: 150 } }, { name: 'Medium carton', dimensions: { length: 600, width: 400, height: 300 } }, { name: 'Large carton', dimensions: { length: 1200, width: 800, height: 600 } }])
await Pallet.insertMany([{ name: 'Euro pallet', dimensions: { length: 1200, width: 800, height: 144 } }, { name: 'ISO pallet', dimensions: { length: 1200, width: 1000, height: 144 } }])
await Container.insertMany([{ name: '20 ft standard', dimensions: { length: 5898, width: 2352, height: 2392 } }, { name: '40 ft standard', dimensions: { length: 12032, width: 2352, height: 2392 } }])
await disconnectDatabase()
console.log('Seed data inserted.')