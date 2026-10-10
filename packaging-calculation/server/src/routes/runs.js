// Calculation runs for a part (sections 1, 4–8 of the part page).
// Phase 3: starting a run only queues it; src/worker.js calculates it in the background.
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import Run from '../models/Run.js';
import Part from '../models/Part.js';
import Carton from '../models/Carton.js';
import Pallet from '../models/Pallet.js';
import Container from '../models/Container.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireFeature } from '../middleware/entitlements.js';
import { HttpError } from '../middleware/errors.js';
import { env } from '../config/env.js';
import { writeRunPdf } from '../pdf.js';

const id = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const runInput = z.object({
  cartonIds: z.array(id).min(1).max(50),
  palletId: id,
  containerIds: z.array(id).min(1).max(10),
  preset: z.enum(['quick', 'standard', 'thorough']).default('standard'),
  settings: z.object({
    optimiseHeight: z.boolean().default(true),
    maxTiers: z.coerce.number().int().min(1).max(3).default(2),
    clearanceMm: z.coerce.number().min(0).max(500).default(50),
    qty: z.coerce.number().int().positive().default(10000)
  }).default({})
});

// Time budget per preset. The box engine needs < 1 s; real-shape packing (Phase 4) uses the budget.
export const PRESETS = { quick: 10000, standard: 60000, thorough: 360000 };

const shareUrl = (run) => `${env.clientUrl}/s/${run.shareToken}`;
const light = '-result -used';

export const runsRouter = Router();
runsRouter.use(requireAuth);
const canEdit = requireRole('owner', 'planner');
const opt = (req) => ({ orgId: req.orgId });

async function nextNumber(orgId) {
  const year = new Date().getFullYear();
  const count = await Run.countDocuments({ number: new RegExp(`^R-${year}-`) }).setOptions({ orgId });
  return `R-${year}-${String(count + 1).padStart(4, '0')}`;
}

// List runs for a part (newest first, without the heavy result).
runsRouter.get('/part/:partId', async (req, res, next) => {
  try {
    res.json(await Run.find({ partId: req.params.partId }).select(light).sort({ createdAt: -1 }).limit(100).setOptions(opt(req)));
  } catch (e) { next(e); }
});

// Start a run: validate, then queue it. Responds 202 at once; poll GET /api/runs/:id for progress.
runsRouter.post('/part/:partId', canEdit, async (req, res, next) => {
  try {
    const body = runInput.parse(req.body);
    const o = opt(req);
    const [part, cartonCount, pallet, containerCount] = await Promise.all([
      Part.findOne({ _id: req.params.partId }).setOptions(o),
      Carton.countDocuments({ _id: { $in: body.cartonIds } }).setOptions(o),
      Pallet.findOne({ _id: body.palletId }).setOptions(o),
      Container.countDocuments({ _id: { $in: body.containerIds } }).setOptions(o)
    ]);
    if (!part) throw new HttpError(404, 'Part not found');
    if (!cartonCount || !pallet || !containerCount) throw new HttpError(400, 'Choose at least one carton, a pallet and a container');
    const active = await Run.countDocuments({ status: { $in: ['queued', 'running'] } }).setOptions(o);
    if (active >= 20) throw new HttpError(429, 'You already have 20 calculations waiting. Let some finish first.');

    let run;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        run = await Run.create({
          orgId: req.orgId, partId: part._id, projectId: part.projectId, createdBy: req.userId,
          number: await nextNumber(req.orgId), status: 'queued', preset: body.preset, budgetMs: PRESETS[body.preset],
          request: { cartonIds: body.cartonIds, palletId: body.palletId, containerIds: body.containerIds, settings: body.settings },
          inputs: { cartonIds: body.cartonIds, palletId: body.palletId, containerIds: body.containerIds },
          shareToken: crypto.randomBytes(24).toString('base64url')
        });
        break;
      } catch (e) {
        if (e?.code !== 11000 || attempt === 2) throw e; // two runs at the same moment: take the next number
      }
    }
    res.status(202).json(run);
  } catch (e) { next(e); }
});

// Running Jobs page: everything queued or running, plus what finished in the last 24 h.
runsRouter.get('/jobs', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const runs = await Run.find({ $or: [{ status: { $in: ['queued', 'running'] } }, { finishedAt: { $gte: since } }] })
      .select('number partId projectId status preset budgetMs progress error startedAt finishedAt createdAt durationMs used')
      .sort({ createdAt: -1 }).limit(200).setOptions(opt(req));
    const parts = await Part.find({ _id: { $in: runs.map((r) => r.partId) } }).select('name projectId').setOptions(opt(req));
    const names = Object.fromEntries(parts.map((p) => [String(p._id), p.name]));
    res.json(runs.map((r) => ({ ...r.toJSON(), partName: names[String(r.partId)] || '(deleted part)' })));
  } catch (e) { next(e); }
});

// Cancel a queued or running calculation.
runsRouter.post('/:id/cancel', canEdit, async (req, res, next) => {
  try {
    const o = opt(req);
    const queued = await Run.findOneAndUpdate({ _id: req.params.id, status: 'queued' }, { status: 'cancelled', finishedAt: new Date(), 'progress.step': 'Cancelled' }, { new: true }).setOptions(o);
    if (queued) return res.json({ status: 'cancelled' });
    const running = await Run.findOneAndUpdate({ _id: req.params.id, status: 'running' }, { cancelRequested: true }, { new: true }).setOptions(o);
    if (!running) throw new HttpError(409, 'This calculation has already finished');
    res.json({ status: 'cancelling' });
  } catch (e) { next(e); }
});

runsRouter.get('/:id', async (req, res, next) => {
  try {
    const run = await Run.findOne({ _id: req.params.id }).setOptions(opt(req));
    if (!run) throw new HttpError(404, 'Run not found');
    res.json({ ...run.toJSON(), shareUrl: shareUrl(run) });
  } catch (e) { next(e); }
});

// Confirm the winner and lock it. A locked run cannot be changed.
runsRouter.post('/:id/lock', canEdit, async (req, res, next) => {
  try {
    const body = z.object({ cartonId: z.string(), containerId: z.string(), algorithm: z.string().default('grid'), reason: z.string().max(1000).default('') }).parse(req.body);
    const run = await Run.findOne({ _id: req.params.id }).setOptions(opt(req));
    if (!run) throw new HttpError(404, 'Run not found');
    if (run.status !== 'done') throw new HttpError(409, 'Wait until the calculation has finished');
    if (run.lock?.at) throw new HttpError(409, 'This result is already locked');
    const carton = run.result.cartons.find((c) => c.id === body.cartonId);
    if (!carton || !carton.containers.some((k) => k.id === body.containerId)) throw new HttpError(400, 'Choose a carton and container from this run');
    const user = await User.findOne({ _id: req.userId }).setOptions(opt(req));
    const lock = { ...body, by: req.userId, byName: user?.name || 'Unknown', at: new Date() };
    await Run.updateOne({ _id: run._id }, { lock }).setOptions(opt(req));
    res.json({ lock });
  } catch (e) { next(e); }
});

// Switch the read-only share link on or off (Business plan).
runsRouter.post('/:id/share', canEdit, requireFeature('shareLinks'), async (req, res, next) => {
  try {
    const { on } = z.object({ on: z.boolean() }).parse(req.body);
    const run = await Run.findOneAndUpdate({ _id: req.params.id }, { shareOn: on }, { new: true }).setOptions(opt(req));
    if (!run) throw new HttpError(404, 'Run not found');
    res.json({ shareOn: run.shareOn, shareUrl: shareUrl(run) });
  } catch (e) { next(e); }
});

runsRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const run = await Run.findOne({ _id: req.params.id }).setOptions(opt(req));
    if (!run) throw new HttpError(404, 'Run not found');
    if (run.status !== 'done') throw new HttpError(409, 'The calculation has not finished yet');
    writeRunPdf(res, { run, orgName: req.org.name, currency: req.org.settings.currency, shareUrl: shareUrl(run) });
  } catch (e) { next(e); }
});

// Public, no login: GET /api/share/r/:token — only while the owner has switched it on.
export const publicRunRouter = Router();
publicRunRouter.get('/:token', async (req, res, next) => {
  try {
    const run = await Run.findOne({ shareToken: req.params.token }).setOptions({ skipTenant: true });
    if (!run || !run.shareOn || run.status !== 'done') throw new HttpError(404, 'This calculation is not shared');
    const org = await Organization.findById(run.orgId).select('name settings.currency');
    res.json({ number: run.number, createdAt: run.createdAt, result: run.result, lock: run.lock, orgName: org?.name, currency: org?.settings?.currency || 'INR' });
  } catch (e) { next(e); }
});
