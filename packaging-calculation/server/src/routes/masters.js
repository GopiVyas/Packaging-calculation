// Routes for the customer's saved data: parts, cartons, pallets, containers.
import { z } from 'zod';
import Part, { SHAPES } from '../models/Part.js';
import Carton from '../models/Carton.js';
import Pallet from '../models/Pallet.js';
import Container from '../models/Container.js';
import Material from '../models/Material.js';
import { resourceRouter } from './resource.js';
import { boxForShape, toKg, suggestCartons, SUGGEST_DEFAULTS } from '../engine/index.js';
import { requireRole } from '../middleware/auth.js';
import { requireFeature } from '../middleware/entitlements.js';
import { HttpError } from '../middleware/errors.js';

const pos = z.coerce.number().positive();
const nonNeg = z.coerce.number().min(0);
const name = z.string().trim().min(1).max(120);

// ---------- Parts ----------
const partSchema = z.object({
  name,
  projectId: z.preprocess((v) => (v ? String(v) : null), z.string().regex(/^[a-f0-9]{24}$/).nullable()).optional(),
  shape: z.enum(SHAPES),
  dims: z.record(z.coerce.number().positive()),
  unit: z.enum(['mm', 'cm', 'in']).default('mm'),
  weight: nonNeg,
  materialId: z.preprocess((v) => (v ? String(v) : null), z.string().regex(/^[a-f0-9]{24}$/).nullable()).optional(),
  weightSource: z.enum(['manual', 'material']).default('manual'),
  weightUnit: z.enum(['kg', 'lb']).default('kg'),
  clearanceMm: nonNeg.default(0),
  upright: z.boolean().default(false),
  color: z.string().nullable().optional()
});

// Volume of a typed shape (mm³) — used for carton fill and for weight from material.
export function shapeVolume(shape, d, unit = 'mm') {
  const f = { mm: 1, cm: 10, in: 25.4 }[unit] || 1;
  const v = (k) => Number(d[k]) * f;
  switch (shape) {
    case 'square': return v('side') ** 2 * v('height');
    case 'circle': return Math.PI * (v('diameter') / 2) ** 2 * v('height');
    case 'diamond': return (v('diagonal1') * v('diagonal2') / 2) * v('thickness');
    default: return v('length') * v('width') * v('height');
  }
}

/** Weight from material: volume (mm³) × density (g/cm³) → kg */
export async function weightFromMaterial(materialId, volumeMm3, orgId) {
  const m = await Material.findOne({ _id: materialId }).setOptions({ orgId });
  if (!m) throw new HttpError(400, 'Material not found');
  if (!volumeMm3) throw new HttpError(400, 'The part has no volume yet, so the weight cannot come from the material. Enter it by hand.');
  return (volumeMm3 / 1000) * m.densityGcm3 / 1000;
}

async function partTransform(data, req, existing) {
  const dims = data.dims instanceof Map ? Object.fromEntries(data.dims) : data.dims;
  const out = { ...data, dims };
  if (data.shape === 'cad') {
    // Geometry of a CAD part only changes by uploading a new file.
    if (!existing?.box?.l) throw new HttpError(400, 'Upload a STEP file to create a CAD part');
    out.box = existing.box;
    out.volumeMm3 = existing.volumeMm3;
    out.dims = {};
  } else {
    try {
      out.box = boxForShape(data.shape, dims, data.unit, data.clearanceMm);
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    out.volumeMm3 = shapeVolume(data.shape, dims, data.unit);
  }
  if (data.weightSource === 'material') {
    if (!data.materialId) throw new HttpError(400, 'Choose a material');
    out.weightKg = await weightFromMaterial(data.materialId, out.volumeMm3, req.orgId);
    out.weight = out.weightKg;
    out.weightUnit = 'kg';
  } else {
    if (!(data.weight > 0)) throw new HttpError(400, 'Enter a weight greater than 0');
    out.weightKg = toKg(data.weight, data.weightUnit);
  }
  return out;
}

export const partsRouter = resourceRouter(Part, { schema: partSchema, limitKey: 'parts', transform: partTransform });

// ---------- Cartons ----------
const cartonSchema = z.object({
  name,
  innerL: pos, innerW: pos, innerH: pos,
  wallMm: nonNeg.default(5),
  maxWeightKg: pos,
  emptyWeightKg: nonNeg.default(0),
  price: nonNeg.default(0),
  isSuggested: z.boolean().default(false),
  active: z.boolean().default(true)
});
export const cartonsRouter = resourceRouter(Carton, { schema: cartonSchema, limitKey: 'cartons' });

// Suggest carton sizes built around a part (Pro and above).
const suggestSchema = z.object({
  partId: z.string(),
  palletId: z.string(),
  containerId: z.string(),
  qty: z.coerce.number().int().positive().default(1000),
  freightCost: nonNeg.optional(),
  constraints: z.object({
    maxOuter: z.tuple([pos, pos, pos]).optional(),
    maxGrossKg: pos.optional(),
    wallMm: nonNeg.optional(),
    slackMm: nonNeg.optional(),
    pricePerM2: nonNeg.optional()
  }).default({})
});

cartonsRouter.post('/suggest', requireRole('owner', 'planner'), requireFeature('suggest'), async (req, res, next) => {
  try {
    const body = suggestSchema.parse(req.body);
    const opt = { orgId: req.orgId };
    const [part, pallet, container] = await Promise.all([
      Part.findOne({ _id: body.partId }).setOptions(opt),
      body.palletId === 'floor' ? { isFloorLoad: true } : Pallet.findOne({ _id: body.palletId }).setOptions(opt),
      Container.findOne({ _id: body.containerId }).setOptions(opt)
    ]);
    if (!part || !pallet || !container) throw new HttpError(404, 'Part, pallet or container not found');
    const freightCost = body.freightCost ?? container.freightCost ?? req.org.settings.defaultFreightCost;
    const picks = suggestCartons({
      part: part.toObject(), pallet: pallet.toObject ? pallet.toObject() : pallet, container: container.toObject(),
      qty: body.qty, freightCost, constraints: body.constraints
    });
    res.json({ constraints: { ...SUGGEST_DEFAULTS, ...body.constraints }, suggestions: picks });
  } catch (e) { next(e); }
});

// ---------- Pallets & containers (standard templates + the customer's own) ----------
const palletSchema = z.object({
  name, L: pos, W: pos, deckH: nonNeg.default(150), maxStackH: pos, maxLoadKg: pos, weightKg: nonNeg.default(25),
  isFloorLoad: z.boolean().default(false)
});
export const palletsRouter = resourceRouter(Pallet, { schema: palletSchema, limitKey: 'pallets', shared: true });

const containerSchema = z.object({ name, innerL: pos, innerW: pos, innerH: pos, payloadKg: pos, freightCost: nonNeg.default(0) });
export const containersRouter = resourceRouter(Container, { schema: containerSchema, limitKey: 'containers', shared: true });

const materialSchema = z.object({ name, densityGcm3: z.coerce.number().min(0.01).max(30) });
export const materialsRouter = resourceRouter(Material, { schema: materialSchema, shared: true });
