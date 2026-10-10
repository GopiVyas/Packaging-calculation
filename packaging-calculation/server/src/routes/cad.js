// STEP / STL upload (Phase 2). The Node API stores the files; the Python CAD service analyses them.
import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { z } from 'zod';
import Part from '../models/Part.js';
import Project from '../models/Project.js';
import { env } from '../config/env.js';
import { requireRole } from '../middleware/auth.js';
import { checkLimit } from '../middleware/entitlements.js';
import { HttpError } from '../middleware/errors.js';
import { weightFromMaterial } from './masters.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.cadMaxMb * 1024 * 1024 } });
const canEdit = requireRole('owner', 'planner');
const EXT = new Set(['.step', '.stp', '.stl']);

function partDir(orgId, partId) {
  return path.join(env.storageDir, String(orgId), String(partId));
}

async function analyze(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXT.has(ext)) throw new HttpError(400, 'Upload a STEP (.step / .stp) or STL file');
  const fd = new FormData();
  fd.append('file', new Blob([file.buffer]), file.originalname);
  let res;
  try {
    res = await fetch(`${env.cadServiceUrl}/analyze`, { method: 'POST', body: fd });
  } catch {
    throw new HttpError(503, 'The CAD service is not running. Start it with: cd cad-service && uvicorn app:app --port 8000');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status === 413 ? 413 : 400, body.detail || 'This file could not be read');
  return { ...body, ext };
}

/** Writes the original file + the GLB model and returns the part fields to save. */
async function storeAndDescribe(orgId, partId, file, a) {
  const dir = partDir(orgId, partId);
  await fs.mkdir(dir, { recursive: true });
  const sourceFile = `source${a.ext}`;
  await fs.writeFile(path.join(dir, sourceFile), file.buffer);
  await fs.writeFile(path.join(dir, 'model.glb'), Buffer.from(a.glbBase64, 'base64'));
  return {
    shape: 'cad',
    dims: {},
    clearanceMm: 0,
    box: a.bbox,
    volumeMm3: a.volumeMm3,
    cad: {
      fileName: a.fileName, format: a.format, sizeBytes: file.size, sourceFile, modelFile: 'model.glb',
      solids: a.solids, areaMm2: a.areaMm2, triangles: a.triangles, watertight: a.watertight,
      orientation: a.orientation, uploadedAt: new Date()
    }
  };
}

const uploadFields = z.object({
  name: z.string().trim().max(120).optional(),
  materialId: z.string().regex(/^[a-f0-9]{24}$/).optional().or(z.literal('')),
  weightG: z.coerce.number().positive().optional().or(z.literal('').transform(() => undefined)),
  upright: z.enum(['true', 'false']).optional()
});

export const cadPartsRouter = Router();

// New part from a file, inside a project: POST /api/projects/:id/parts/cad  (multipart: file, name?, materialId? | weightG?)
export const cadProjectRouter = Router();
cadProjectRouter.post('/:id/parts/cad', canEdit, checkLimit('parts', Part), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Choose a file to upload');
    const f = uploadFields.parse(req.body);
    if (!f.materialId && !f.weightG) throw new HttpError(400, 'Choose a material or enter the weight per part');
    const project = await Project.findOne({ _id: req.params.id }).setOptions({ orgId: req.orgId });
    if (!project) throw new HttpError(404, 'Project not found');

    const a = await analyze(req.file);
    const partId = new mongoose.Types.ObjectId();
    const fields = await storeAndDescribe(req.orgId, partId, req.file, a);

    let name = (f.name || path.parse(req.file.originalname).name).slice(0, 110);
    if (await Part.exists({ name }).setOptions({ orgId: req.orgId })) name = `${name} (${Date.now().toString(36)})`;

    const weight = f.weightG
      ? { weightSource: 'manual', weight: f.weightG / 1000, weightUnit: 'kg', weightKg: f.weightG / 1000 }
      : await (async () => {
        const kg = await weightFromMaterial(f.materialId, fields.volumeMm3, req.orgId);
        return { weightSource: 'material', materialId: f.materialId, weight: kg, weightUnit: 'kg', weightKg: kg };
      })();

    const part = await Part.create({ _id: partId, orgId: req.orgId, projectId: project._id, name, unit: 'mm', upright: f.upright === 'true', ...fields, ...weight });
    res.status(201).json(part);
  } catch (e) { next(e); }
});

// Replace the geometry of an existing part: POST /api/parts/:id/cad  (multipart: file)
cadPartsRouter.post('/:id/cad', canEdit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Choose a file to upload');
    const part = await Part.findOne({ _id: req.params.id }).setOptions({ orgId: req.orgId });
    if (!part) throw new HttpError(404, 'Part not found');
    const a = await analyze(req.file);
    const fields = await storeAndDescribe(req.orgId, part._id, req.file, a);
    if (part.weightSource === 'material' && part.materialId) {
      fields.weightKg = await weightFromMaterial(part.materialId, fields.volumeMm3, req.orgId);
      fields.weight = fields.weightKg;
    }
    const updated = await Part.findOneAndUpdate({ _id: part._id }, fields, { new: true }).setOptions({ orgId: req.orgId });
    res.json(updated);
  } catch (e) { next(e); }
});

// 3D model for the browser, and the original file for download.
async function sendFile(req, res, next, which) {
  try {
    const part = await Part.findOne({ _id: req.params.id }).setOptions({ orgId: req.orgId });
    if (!part?.cad?.modelFile) throw new HttpError(404, 'This part has no CAD file');
    const file = which === 'model' ? part.cad.modelFile : part.cad.sourceFile;
    const full = path.join(partDir(req.orgId, part._id), file);
    await fs.access(full).catch(() => { throw new HttpError(404, 'File missing on the server'); });
    if (which === 'model') {
      res.setHeader('Content-Type', 'model/gltf-binary');
      res.setHeader('Cache-Control', 'private, max-age=300');
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(part.cad.fileName || file)}"`);
    }
    createReadStream(full).pipe(res);
  } catch (e) { next(e); }
}
cadPartsRouter.get('/:id/model.glb', (req, res, next) => sendFile(req, res, next, 'model'));
cadPartsRouter.get('/:id/source', (req, res, next) => sendFile(req, res, next, 'source'));
