import { PlanLimitError } from './errors.js';

const FEATURE_TEXT = {
  suggest: 'Carton suggestions',
  savePlans: 'Saving plans',
  mixedOrders: 'Orders with more than one part',
  shareLinks: 'Warehouse share links',
  api: 'API access'
};

/** Blocks the route unless the customer's current plan includes the feature. */
export const requireFeature = (feature) => (req, _res, next) => {
  if (req.ent?.features?.[feature]) return next();
  next(new PlanLimitError(`${FEATURE_TEXT[feature] || feature} is not included in the ${req.ent?.label || 'Free'} plan.`, { feature }));
};

/**
 * Blocks creating a record when the customer already has as many as the plan allows.
 * `limitKey` matches PLANS[x].limits (e.g. 'parts'); counts only the customer's own records.
 */
export const checkLimit = (limitKey, Model) => async (req, _res, next) => {
  try {
    const limit = req.ent?.limits?.[limitKey];
    if (limit === null || limit === undefined) return next(); // null = no limit
    const count = await Model.countDocuments({ orgId: req.orgId }).setOptions({ orgId: req.orgId });
    if (count >= limit) {
      return next(new PlanLimitError(`Your ${req.ent.label} plan allows ${limit} ${limitKey}. Upgrade to add more.`, { limitKey, limit }));
    }
    next();
  } catch (e) {
    next(e);
  }
};
