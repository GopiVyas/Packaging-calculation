import mongoose from 'mongoose';

/**
 * Multi-tenant guard. Every customer (Organization) shares the same collections;
 * this plugin makes it impossible to read or change another customer's data by accident.
 *
 * Usage (always pass the orgId taken from the logged-in user's token, never from the request body):
 *   Part.find({}).setOptions({ orgId: req.orgId })
 *   Part.findOneAndUpdate({ _id }, patch).setOptions({ orgId: req.orgId })
 *
 * Options:
 *   shared: true  -> reads also return records with orgId = null (standard templates such as
 *                    EUR pallet / 20 ft container). Writes still only touch the customer's own records.
 *
 * A query without orgId throws, unless it explicitly sets { skipTenant: true }
 * (only used by the seed script and the platform admin).
 */
const READ_OPS = ['find', 'findOne', 'countDocuments'];
const WRITE_OPS = ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany', 'replaceOne'];

export default function tenantPlugin(schema, { shared = false } = {}) {
  schema.add({
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null }
  });

  function scope(isRead) {
    return function () {
      const opts = this.getOptions();
      if (opts.skipTenant) return;
      if (!opts.orgId) throw new Error(`Tenant guard: ${this.model.modelName}.${this.op} called without orgId`);
      // A shared read with no explicit orgId filter also returns templates;
      // any explicit orgId filter is always replaced with the caller's own orgId.
      const asksForOrg = Object.prototype.hasOwnProperty.call(this.getFilter(), 'orgId');
      if (isRead && shared && !asksForOrg) this.where({ orgId: { $in: [opts.orgId, null] } });
      else this.where({ orgId: opts.orgId });
    };
  }

  READ_OPS.forEach((op) => schema.pre(op, scope(true)));
  WRITE_OPS.forEach((op) => schema.pre(op, scope(false)));

  // Aggregations must start with a $match on orgId.
  schema.pre('aggregate', function () {
    const opts = this.options || {};
    if (opts.skipTenant) return;
    if (!opts.orgId) throw new Error('Tenant guard: aggregate called without orgId');
    this.pipeline().unshift({ $match: { orgId: new mongoose.Types.ObjectId(String(opts.orgId)) } });
  });

  // New documents must belong to a customer (templates are created by the seed with insertMany).
  schema.pre('save', function () {
    if (!this.orgId && !this.$locals.skipTenant) {
      throw new Error(`Tenant guard: ${this.constructor.modelName} saved without orgId`);
    }
  });
}
