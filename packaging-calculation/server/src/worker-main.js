// Standalone worker: `npm run worker` (use with RUN_WORKER=false on the API server).
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { startWorker } from './worker.js';

await mongoose.connect(env.mongoUri);
console.log('MongoDB connected (worker)');
startWorker();
