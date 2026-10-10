import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { startWorker } from './worker.js';

await mongoose.connect(env.mongoUri);
console.log('MongoDB connected');

createApp().listen(env.port, () => console.log(`API on http://127.0.0.1:${env.port}`));

if (env.runWorkerInApi) startWorker();
