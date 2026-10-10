import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { checkLimit } from '../middleware/entitlements.js';
import { HttpError } from '../middleware/errors.js';

/**
 * Standard list / get / create / update / delete routes for one customer-owned collection.
 * orgId always comes from req.orgId (the login token). Anything the client sends as orgId is dropped.
 *
 * options:
 *   schema     zod schema for create (update uses schema.partial())
 *   limitKey   key in PLANS[x].limits checked on create
 *   transform  (data, req, existing) => data   e.g. calculate a part's box size (existing = the saved doc on update)
 *   shared     true if the model also has read-only templates (orgId null)
 */
export function resourceRouter(Model, { schema, limitKey, transform = (d) => d, shared = false, sort = { name: 1 } }) {
  const router = Router();
  const canEdit = requireRole('owner', 'planner');
  const scoped = (q, req) => q.setOptions({ orgId: req.orgId });
  const clean = (body) => {
    const { orgId, _id, createdAt, updatedAt, ...rest } = body || {};
    return rest;
  };
  const withOwner = (doc, req) => {
    const o = doc.toJSON ? doc.toJSON() : doc;
    return shared ? { ...o, isTemplate: !o.orgId, canEdit: String(o.orgId) === String(req.orgId) } : o;
  };

  router.get('/', async (req, res, next) => {
    try {
      const docs = await scoped(Model.find({}).sort(shared ? { orgId: 1, ...sort } : sort), req);
      res.json(docs.map((d) => withOwner(d, req)));
    } catch (e) { next(e); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const doc = await scoped(Model.findOne({ _id: req.params.id }), req);
      if (!doc) throw new HttpError(404, 'Not found');
      res.json(withOwner(doc, req));
    } catch (e) { next(e); }
  });

  router.post('/', canEdit, ...(limitKey ? [checkLimit(limitKey, Model)] : []), async (req, res, next) => {
    try {
      const data = await transform(schema.parse(clean(req.body)), req);
      const doc = await Model.create({ ...data, orgId: req.orgId });
      res.status(201).json(withOwner(doc, req));
    } catch (e) { next(e); }
  });

  router.put('/:id', canEdit, async (req, res, next) => {
    try {
      const existing = await scoped(Model.findOne({ _id: req.params.id, orgId: req.orgId }), req);
      if (!existing) throw new HttpError(404, shared ? 'Standard templates cannot be edited. Make a copy first.' : 'Not found');
      const merged = { ...existing.toObject({ flattenMaps: true }), ...schema.partial().parse(clean(req.body)) };
      const data = await transform(schema.parse(clean(merged)), req, existing);
      const doc = await scoped(Model.findOneAndUpdate({ _id: req.params.id }, data, { new: true, runValidators: true }), req);
      res.json(withOwner(doc, req));
    } catch (e) { next(e); }
  });

  router.delete('/:id', canEdit, async (req, res, next) => {
    try {
      const r = await scoped(Model.deleteOne({ _id: req.params.id }), req);
      if (!r.deletedCount) throw new HttpError(404, shared ? 'Standard templates cannot be deleted' : 'Not found');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  if (shared) {
    // Copy a standard template (or own record) into the customer's account so it can be edited.
    router.post('/:id/copy', canEdit, ...(limitKey ? [checkLimit(limitKey, Model)] : []), async (req, res, next) => {
      try {
        const src = await scoped(Model.findOne({ _id: req.params.id }), req);
        if (!src) throw new HttpError(404, 'Not found');
        const { _id, orgId, createdAt, updatedAt, __v, ...rest } = src.toObject();
        const doc = await Model.create({ ...rest, name: `${rest.name} (copy)`, orgId: req.orgId });
        res.status(201).json(withOwner(doc, req));
      } catch (e) { next(e); }
    });
  }

  return router;
}
