import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import plansRouter, { shareRouter } from './routes/plans.js';
import { partsRouter, cartonsRouter, palletsRouter, containersRouter, materialsRouter } from './routes/masters.js';
import { cadPartsRouter, cadProjectRouter } from './routes/cad.js';
import { requireAuth } from './middleware/auth.js';
import { projectsRouter } from './routes/projects.js';
import { runsRouter, publicRunRouter } from './routes/runs.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { SHAPE_FIELDS, GOALS } from './engine/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/meta', (_req, res) => res.json({ shapes: SHAPE_FIELDS, goals: Object.fromEntries(Object.entries(GOALS).map(([k, g]) => [k, g.name])) }));

  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }), authRouter);
  app.use('/api/share/r', rateLimit({ windowMs: 60 * 1000, limit: 60 }), publicRunRouter);
  app.use('/api/share', rateLimit({ windowMs: 60 * 1000, limit: 60 }), shareRouter);

  // Everything below needs a logged-in user; req.orgId is set from their token.
  app.use('/api/projects', requireAuth, cadProjectRouter, projectsRouter);
  app.use('/api/parts', requireAuth, cadPartsRouter, partsRouter);
  app.use('/api/materials', requireAuth, materialsRouter);
  app.use('/api/cartons', requireAuth, cartonsRouter);
  app.use('/api/pallets', requireAuth, palletsRouter);
  app.use('/api/containers', requireAuth, containersRouter);
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/runs', runsRouter);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
