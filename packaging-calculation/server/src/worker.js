// Background job worker (Phase 3). The queue is the `runs` collection itself:
//   queued → running → done | failed | cancelled
// A worker claims the oldest queued run atomically, so several workers (or servers) can run side by side.
// Started inside the API by default; set RUN_WORKER=false and run `npm run worker` to move it to its own process.
import { Worker } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import Run from './models/Run.js';
import Part from './models/Part.js';
import Carton from './models/Carton.js';
import Pallet from './models/Pallet.js';
import Container from './models/Container.js';
import { env } from './config/env.js';

const SYS = { skipTenant: true };
const POLL_MS = 1000;
const STALE_MS = 15 * 60 * 1000;

async function loadInputs(run) {
  const o = { orgId: run.orgId };
  const req = run.request;
  const [part, cartons, pallet, containers] = await Promise.all([
    Part.findOne({ _id: run.partId }).setOptions(o),
    Carton.find({ _id: { $in: req.cartonIds } }).setOptions(o),
    Pallet.findOne({ _id: req.palletId }).setOptions(o),
    Container.find({ _id: { $in: req.containerIds } }).setOptions(o)
  ]);
  if (!part) throw new Error('The part was deleted');
  if (!cartons.length || !pallet || !containers.length) throw new Error('A carton, pallet or container of this run was deleted');
  return {
    part: part.toObject({ flattenMaps: true }),
    cartons: cartons.map((c) => c.toObject()),
    pallet: pallet.toObject(),
    containers: containers.map((c) => c.toObject()),
    settings: req.settings,
    used: { cartons: cartons.map((c) => c.name), pallet: pallet.name, containers: containers.map((c) => c.name) }
  };
}

/**
 * Phase 4: real-shape packing by the CAD service for parts with a CAD model (not for "quick").
 * Returns null when not applicable; throws with a readable message when the service fails.
 */
async function realShapePack(run, data) {
  if (data.part.shape !== 'cad' || !data.part.cad?.modelFile || run.preset === 'quick') return null;
  const file = path.join(env.storageDir, String(run.orgId), String(run.partId), data.part.cad.modelFile);
  const glb = await fs.readFile(file).catch(() => { throw new Error('the 3D model file is missing on the server'); });
  const fd = new FormData();
  fd.append('file', new Blob([glb]), 'model.glb');
  fd.append('request', JSON.stringify({
    cartons: data.cartons.map((c) => ({ id: String(c._id), innerL: c.innerL, innerW: c.innerW, innerH: c.innerH })),
    upright: !!data.part.upright,
    preset: run.preset,
    budgetS: Math.max(5, (run.budgetMs / 1000) * 0.8)
  }));
  let res;
  try {
    res = await fetch(`${env.cadServiceUrl}/pack`, { method: 'POST', body: fd, signal: AbortSignal.timeout(run.budgetMs * 1.2) });
  } catch (e) {
    throw new Error(e?.name === 'TimeoutError' ? 'real-shape packing took longer than the time budget' : 'the CAD service is not running');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `CAD service error ${res.status}`);
  return body;
}

/** Calculates one claimed run in a thread; resolves when it is finished. */
async function processRun(run) {
  const set = (fields) => Run.updateOne({ _id: run._id }, fields).setOptions(SYS);
  let inputs;
  try {
    inputs = await loadInputs(run);
  } catch (e) {
    return set({ status: 'failed', error: e.message, finishedAt: new Date() });
  }
  const { used, ...data } = inputs;
  await set({ used, 'progress.step': 'Starting', 'progress.pct': 0 });

  // Phase 4: real-shape packing first (the CAD service), then the full calculation with its counts.
  let realShape = null;
  let realShapeError = null;
  if (data.part.shape === 'cad' && run.preset !== 'quick') {
    await set({ 'progress.step': `Real-shape packing — ${data.cartons.length} carton(s), every orientation`, 'progress.pct': 5 });
    try {
      realShape = await realShapePack(run, data);
    } catch (e) {
      realShapeError = `Real-shape packing skipped: ${e.message}. Counts use box packing only.`;
    }
    const r = await Run.findOne({ _id: run._id }).select('cancelRequested').setOptions(SYS);
    if (r?.cancelRequested) return set({ status: 'cancelled', 'progress.step': 'Cancelled', finishedAt: new Date() });
    await set({ 'progress.step': 'Pallets and containers', 'progress.pct': 80 });
  }

  return new Promise((resolve) => {
    const thread = new Worker(new URL('./engine/thread.js', import.meta.url), {
      workerData: { ...data, realShape, settings: { ...data.settings, ...(realShapeError ? { realShapeError } : {}) } }
    });
    let finished = false;
    const finish = async (fields) => {
      if (finished) return;
      finished = true;
      clearInterval(watch);
      clearTimeout(limit);
      await thread.terminate().catch(() => {});
      await set({ ...fields, finishedAt: new Date() });
      resolve();
    };
    // Cancel button and time budget (budget + 50 % grace).
    const watch = setInterval(async () => {
      const r = await Run.findOne({ _id: run._id }).select('cancelRequested').setOptions(SYS).catch(() => null);
      if (r?.cancelRequested) finish({ status: 'cancelled', 'progress.step': 'Cancelled' });
    }, 1000);
    const limit = setTimeout(() => finish({ status: 'failed', error: `Stopped after the time budget of ${Math.round(run.budgetMs / 1000)} s` }), run.budgetMs * 1.5);

    thread.on('message', (m) => {
      if (m.type === 'progress') set({ 'progress.pct': m.pct, 'progress.step': m.step }).catch(() => {});
      else if (m.type === 'done') {
        const started = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
        finish({ status: 'done', result: m.result, durationMs: Date.now() - started, 'progress.pct': 100, 'progress.step': 'Done' });
      } else if (m.type === 'error') finish({ status: 'failed', error: m.message });
    });
    thread.on('error', (e) => finish({ status: 'failed', error: e.message }));
    thread.on('exit', (code) => code !== 0 && finish({ status: 'failed', error: `The calculation stopped unexpectedly (code ${code})` }));
  });
}

async function claim() {
  return Run.findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'running', startedAt: new Date(), 'progress.step': 'Starting' }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, new: true }
  ).setOptions(SYS);
}

/** Runs left "running" by a crashed server go back to the queue (max 3 attempts). */
async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_MS);
  await Run.updateMany({ status: 'running', startedAt: { $lt: cutoff }, attempts: { $lt: 3 } }, { status: 'queued' }).setOptions(SYS);
  await Run.updateMany({ status: 'running', startedAt: { $lt: cutoff }, attempts: { $gte: 3 } }, { status: 'failed', error: 'Gave up after 3 attempts' }).setOptions(SYS);
}

export function startWorker({ concurrency = env.workerConcurrency } = {}) {
  let active = 0;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      while (active < concurrency) {
        const run = await claim();
        if (!run) break;
        active++;
        processRun(run).catch((e) => console.error('Run failed', run.number, e)).finally(() => { active--; });
      }
    } catch (e) {
      console.error('Worker poll error', e.message);
    }
    setTimeout(tick, POLL_MS);
  };
  recoverStale().catch(() => {}).finally(tick);
  setInterval(() => recoverStale().catch(() => {}), 5 * 60 * 1000).unref();
  console.log(`Calculation worker started (${concurrency} at a time)`);
  return { stop: () => { stopped = true; } };
}
