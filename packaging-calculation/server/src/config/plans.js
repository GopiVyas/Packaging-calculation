// Subscription plans: the single source of truth for what each plan can do.
// The server enforces these (middleware/entitlements.js) and the client reads
// them from GET /api/auth/me to show lock icons and upgrade prompts.

export const PLANS = {
  free: {
    label: 'Free',
    priceInrMonthly: 0,
    limits: { parts: 1, cartons: 1, pallets: 0, containers: 0, users: 1, savedPlans: 0 },
    features: { suggest: false, savePlans: false, mixedOrders: false, shareLinks: false, api: false }
  },
  pro: {
    label: 'Pro',
    priceInrMonthly: 999,
    limits: { parts: 200, cartons: 100, pallets: 20, containers: 20, users: 1, savedPlans: 500 },
    features: { suggest: true, savePlans: true, mixedOrders: false, shareLinks: false, api: false }
  },
  business: {
    label: 'Business',
    priceInrMonthly: 3999,
    limits: { parts: Infinity, cartons: Infinity, pallets: Infinity, containers: Infinity, users: 10, savedPlans: Infinity },
    features: { suggest: true, savePlans: true, mixedOrders: true, shareLinks: true, api: false }
  },
  enterprise: {
    label: 'Enterprise',
    priceInrMonthly: null,
    limits: { parts: Infinity, cartons: Infinity, pallets: Infinity, containers: Infinity, users: Infinity, savedPlans: Infinity },
    features: { suggest: true, savePlans: true, mixedOrders: true, shareLinks: true, api: true }
  }
};

// Which plan's rules apply right now. Trials get their plan until trialEndsAt;
// unpaid or cancelled subscriptions fall back to Free (data is kept, never deleted).
export function effectivePlanKey(org) {
  if (!org) return 'free';
  const now = Date.now();
  if (org.subscriptionStatus === 'active') return org.plan;
  if (org.subscriptionStatus === 'trialing' && org.trialEndsAt && org.trialEndsAt.getTime() > now) return org.plan;
  if (org.subscriptionStatus === 'past_due' && org.graceEndsAt && org.graceEndsAt.getTime() > now) return org.plan;
  return 'free';
}

export function entitlementsFor(org) {
  const key = effectivePlanKey(org);
  const p = PLANS[key];
  // JSON can't carry Infinity, so the client receives null for "no limit".
  const limits = Object.fromEntries(Object.entries(p.limits).map(([k, v]) => [k, Number.isFinite(v) ? v : null]));
  return { plan: key, label: p.label, limits, features: { ...p.features } };
}
