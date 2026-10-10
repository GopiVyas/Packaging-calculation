import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import Organization from '../models/Organization.js';
import { entitlementsFor } from '../config/plans.js';
import { HttpError } from './errors.js';

export const COOKIE = 'ps_token';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), org: String(user.orgId), role: user.role }, env.jwtSecret, { expiresIn: '7d' });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 3600 * 1000
  });
}

/**
 * Reads the login cookie (or a Bearer token), then sets:
 *   req.userId, req.role, req.orgId  -> the ONLY source of orgId for every query
 *   req.org, req.ent                -> organization + current plan entitlements
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    const token = req.cookies?.[COOKIE] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) throw new HttpError(401, 'Please log in');
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Your session has expired. Please log in again.');
    }
    const org = await Organization.findById(payload.org);
    if (!org) throw new HttpError(401, 'Account not found');
    req.userId = payload.sub;
    req.role = payload.role;
    req.orgId = org._id;
    req.org = org;
    req.ent = entitlementsFor(org);
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.role) ? next() : next(new HttpError(403, 'You do not have permission to do this'));
