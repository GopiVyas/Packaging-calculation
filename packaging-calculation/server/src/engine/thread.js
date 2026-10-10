// Runs one calculation in its own thread so the API stays responsive.
// Receives { part, cartons, pallet, containers, settings }, posts { type: 'progress' | 'done' | 'error' }.
import { parentPort, workerData } from 'node:worker_threads';
import { runPart } from './run.js';

try {
  let last = 0;
  const result = runPart({
    ...workerData,
    onProgress: (p) => {
      const now = Date.now();
      if (now - last > 250 || p.pct >= 100) { // don't flood the database with updates
        last = now;
        parentPort.postMessage({ type: 'progress', ...p });
      }
    }
  });
  parentPort.postMessage({ type: 'done', result });
} catch (e) {
  parentPort.postMessage({ type: 'error', message: e?.message || String(e) });
}
