import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import Plan from '../models/Plan.js';
import Part from '../models/Part.js';
import Carton from '../models/Carton.js';
import Pallet from '../models/Pallet.js';
import Container from '../models/Container.js';
import Organization from '../models/Organization.js';
import { calculatePlan } from '../engine/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireFeature, checkLimit } from '../middleware/entitlements.js';
import { HttpError, PlanLimitError } from '../middleware/errors.js';

const GOAL = z.enum(['cost', 'containers', 'cartons', 'space']);
const inputsSchema = z.object({
  lines: z.array(z.object({ partId: z.string(), qty: z.coerce.number().int().positive() })).min(1).max(50),
  cartonIds: z.array(z.string()).min(1).max(50),
  palletId: z.string(), // 'floor' = no pallet
  containerId: z.string(),
  freightCost: z.coerce.number().min(0).optional()
});

/** Loads everything the inputs point to (only from this customer's account + templates) and runs the engine. */
async function runEngine(inputs, req) {
  if (inputs.lines.length > 1 && !req.ent.features.mixedOrders) {
    throw new PlanLimitError(`Orders with more than one part are included in the Business plan.`, { feature: 'mixedOrders' });
  }
  const opt = { orgId: req.orgId };
  const partIds = [...new Set(inputs.lines.map((l) => l.partId))];
  const [parts, cartons, pallet, container] = await Promise.all([
    Part.find({ _id: { $in: partIds } }).setOptions(opt),
    Carton.find({ _id: { $in: inputs.cartonIds } }).setOptions(opt),
    inputs.palletId === 'floor' ? { isFloorLoad: true } : Pallet.findOne({ _id: inputs.palletId }).setOptions(opt),
    Container.findOne({ _id: inputs.containerId }).setOptions(opt)
  ]);
  if (parts.length !== partIds.length) throw new HttpError(400, 'One of the parts was not found');
  if (!cartons.length) throw new HttpError(400, 'Choose at least one carton');
  if (!pallet) throw new HttpError(400, 'Pallet not found');
  if (!container) throw new HttpError(400, 'Container not found');
  const byId = new Map(parts.map((p) => [String(p._id), p.toObject({ flattenMaps: true })]));
  const freightCost = inputs.freightCost ?? container.freightCost ?? req.org.settings.defaultFreightCost;
  return calculatePlan({
    lines: inputs.lines.map((l) => ({ part: byId.get(l.partId), qty: l.qty })),
    cartons: cartons.map((c) => c.toObject()),
    pallet: pallet.toObject ? pallet.toObject() : pallet,
    container: container.toObject(),
    freightCost
  });
}

const router = Router();
router.use(requireAuth);
const canEdit = requireRole('owner', 'planner');
const scoped = (q, req) => q.setOptions({ orgId: req.orgId });

// Calculate without saving (available on every plan, including Free).
router.post('/calculate', canEdit, async (req, res, next) => {
  try {
    res.json(await runEngine(inputsSchema.parse(req.body), req));
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const plans = await scoped(Plan.find({}).select('name goal createdAt inputs.lines shareToken').sort({ createdAt: -1 }).limit(200), req);
    res.json(plans);
  } catch (e) { next(e); }
});

// Save: the server recalculates from the inputs, so a saved result can always be trusted.
router.post('/', canEdit, requireFeature('savePlans'), checkLimit('savedPlans', Plan), async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().trim().min(1).max(160), goal: GOAL.default('cost'), inputs: inputsSchema }).parse(req.body);
    const result = await runEngine(body.inputs, req);
    const plan = await Plan.create({ orgId: req.orgId, createdBy: req.userId, name: body.name, goal: body.goal, inputs: body.inputs, result });
    res.status(201).json(plan);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const plan = await scoped(Plan.findOne({ _id: req.params.id }), req);
    if (!plan) throw new HttpError(404, 'Plan not found');
    res.json(plan);
  } catch (e) { next(e); }
});

router.patch('/:id', canEdit, async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().trim().min(1).max(160).optional(), goal: GOAL.optional() }).parse(req.body);
    const plan = await scoped(Plan.findOneAndUpdate({ _id: req.params.id }, body, { new: true }), req);
    if (!plan) throw new HttpError(404, 'Plan not found');
    res.json(plan);
  } catch (e) { next(e); }
});

router.delete('/:id', canEdit, async (req, res, next) => {
  try {
    const r = await scoped(Plan.deleteOne({ _id: req.params.id }), req);
    if (!r.deletedCount) throw new HttpError(404, 'Plan not found');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Read-only link for the warehouse phone (Business plan).
router.post('/:id/share', canEdit, requireFeature('shareLinks'), async (req, res, next) => {
  try {
    const days = z.coerce.number().int().min(1).max(90).default(30).parse(req.body?.days);
    const plan = await scoped(Plan.findOneAndUpdate(
      { _id: req.params.id },
      { shareToken: crypto.randomBytes(24).toString('base64url'), shareExpiresAt: new Date(Date.now() + days * 864e5) },
      { new: true }
    ), req);
    if (!plan) throw new HttpError(404, 'Plan not found');
    res.json({ shareToken: plan.shareToken, shareExpiresAt: plan.shareExpiresAt });
  } catch (e) { next(e); }
});

router.delete('/:id/share', canEdit, async (req, res, next) => {
  try {
    await scoped(Plan.updateOne({ _id: req.params.id }, { shareToken: null, shareExpiresAt: null }), req);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

// Public, no login: GET /api/share/:token
export const shareRouter = Router();
shareRouter.get('/:token', async (req, res, next) => {
  try {
    const plan = await Plan.findOne({ shareToken: req.params.token }).setOptions({ skipTenant: true });
    if (!plan || (plan.shareExpiresAt && plan.shareExpiresAt < new Date())) throw new HttpError(404, 'This link has expired or was turned off');
    const org = await Organization.findById(plan.orgId).select('name');
    res.json({ name: plan.name, goal: plan.goal, result: plan.result, orgName: org?.name, createdAt: plan.createdAt });
  } catch (e) { next(e); }
});
