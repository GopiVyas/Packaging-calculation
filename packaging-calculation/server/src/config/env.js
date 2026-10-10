import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export const env = {
  get mongoUri() { return required('MONGODB_URI'); },
  get jwtSecret() { return required('JWT_SECRET'); },
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',
  port: Number(process.env.PORT || 4000),
  isProd: process.env.NODE_ENV === 'production',
  trialDays: Number(process.env.TRIAL_DAYS || 14),
  // Phase 2: Python CAD service and where uploaded CAD files are stored
  cadServiceUrl: process.env.CAD_SERVICE_URL || 'http://127.0.0.1:8000',
  storageDir: process.env.STORAGE_DIR || new URL('../../storage', import.meta.url).pathname,
  cadMaxMb: Number(process.env.CAD_MAX_MB || 50),
  // Phase 3: background calculations
  runWorkerInApi: process.env.RUN_WORKER !== 'false',
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 2)
};
