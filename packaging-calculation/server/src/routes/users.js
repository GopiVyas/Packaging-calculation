// Team members inside one customer account (Owner only).
// Phase 1 keeps it simple: the owner sets a temporary password. Email invites come with Phase 2.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User, { ROLES } from '../models/User.js';
import { requireRole } from '../middleware/auth.js';
import { checkLimit } from '../middleware/entitlements.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(requireRole('owner'));
const scoped = (q, req) => q.setOptions({ orgId: req.orgId });

router.get('/', async (req, res, next) => {
  try {
    res.json(await scoped(User.find({}).sort({ createdAt: 1 }), req));
  } catch (e) { next(e); }
});

router.post('/', checkLimit('users', User), async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(ROLES).default('planner'),
      password: z.string().min(8).max(200)
    }).parse(req.body);
    const exists = await User.findOne({ email: body.email }).setOptions({ skipTenant: true });
    if (exists) throw new HttpError(409, 'This email is already used by another account');
    const user = await User.create({ orgId: req.orgId, name: body.name, email: body.email, role: body.role, passwordHash: await bcrypt.hash(body.password, 12) });
    res.status(201).json(user);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(ROLES) }).parse(req.body);
    if (req.params.id === req.userId) throw new HttpError(400, 'You cannot change your own role');
    const user = await scoped(User.findOneAndUpdate({ _id: req.params.id }, { role }, { new: true }), req);
    if (!user) throw new HttpError(404, 'User not found');
    res.json(user);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.userId) throw new HttpError(400, 'You cannot remove yourself');
    const r = await scoped(User.deleteOne({ _id: req.params.id }), req);
    if (!r.deletedCount) throw new HttpError(404, 'User not found');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
