import mongoose from 'mongoose';
import tenantPlugin from '../plugins/tenant.js';

// One calculation run for one part. Settings and results are frozen forever:
// loading an old run shows its numbers, it never recomputes.
const runSchema = new mongoose.Schema(
  {
    number: { type: String, required: true }, // R-2026-0001
    partId: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Phase 3: runs are queued and calculated by a background worker (src/worker.js)
    status: { type: String, enum: ['queued', 'running', 'done', 'failed', 'cancelled'], default: 'queued', index: true },
    preset: { type: String, default: 'standard' },
    budgetMs: { type: Number, default: 60000 },
    request: { type: mongoose.Schema.Types.Mixed }, // the validated settings the worker calculates from
    progress: { pct: { type: Number, default: 0 }, step: { type: String, default: 'Waiting in the queue' } },
    error: String,
    cancelRequested: { type: Boolean, default: false },
    startedAt: Date,
    finishedAt: Date,
    attempts: { type: Number, default: 0 },
    inputs: {
      cartonIds: [String],
      palletId: String,
      containerIds: [String]
    },
    // Human-readable copy of what was used (survives later edits to master data)
    used: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
    durationMs: Number,
    lock: {
      cartonId: String,
      containerId: String,
      algorithm: String,
      reason: String,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byName: String,
      at: Date
    },
    shareToken: { type: String, required: true },
    shareOn: { type: Boolean, default: false }
  },
  { timestamps: true }
);

runSchema.plugin(tenantPlugin);
runSchema.index({ orgId: 1, number: 1 }, { unique: true });
runSchema.index({ shareToken: 1 }, { unique: true });

export default mongoose.model('Run', runSchema);
