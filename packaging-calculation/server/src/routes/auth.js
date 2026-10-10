import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { entitlementsFor, PLANS } from '../config/plans.js';
import { requireAuth, signToken, setAuthCookie, COOKIE } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

const signupSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200)
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });
const publicOrg = (o) => ({
  id: o._id, name: o.name, plan: o.plan, subscriptionStatus: o.subscriptionStatus,
  trialEndsAt: o.trialEndsAt, settings: o.settings
});

// Sign-up creates the customer company (Organization) and its Owner, on a Pro trial.
router.post('/signup', async (req, res, next) => {
  let org;
  try {
    const body = signupSchema.parse(req.body);
    const exists = await User.findOne({ email: body.email }).setOptions({ skipTenant: true });
    if (exists) throw new HttpError(409, 'An account with this email already exists. Please log in.');
    org = await Organization.create({
      name: body.orgName,
      plan: 'pro',
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + env.trialDays * 24 * 3600 * 1000)
    });
    const user = await User.create({
      orgId: org._id,
      name: body.name,
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: 'owner'
    });
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: publicUser(user), org: publicOrg(org), entitlements: entitlementsFor(org) });
  } catch (e) {
    if (org && !res.headersSent) await Organization.deleteOne({ _id: org._id });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    // Login is the one place we look a user up before knowing their orgId.
    const user = await User.findOne({ email: body.email }).select('+passwordHash').setOptions({ skipTenant: true });
    const ok = user && (await bcrypt.compare(body.password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'Email or password is incorrect');
    const org = await Organization.findById(user.orgId);
    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() }).setOptions({ orgId: user.orgId });
    setAuthCookie(res, signToken(user));
    res.json({ user: publicUser(user), org: publicOrg(org), entitlements: entitlementsFor(org) });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { httpOnly: true, secure: env.isProd, sameSite: env.isProd ? 'none' : 'lax' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).setOptions({ orgId: req.orgId });
    if (!user) throw new HttpError(401, 'Please log in');
    res.json({ user: publicUser(user), org: publicOrg(req.org), entitlements: req.ent });
  } catch (e) {
    next(e);
  }
});

// Public price list for the pricing page.
router.get('/plans', (_req, res) => {
  res.json(Object.entries(PLANS).map(([key, p]) => ({ key, label: p.label, priceInrMonthly: p.priceInrMonthly, features: p.features })));
});

export default router;
