import mongoose from 'mongoose';

// One document per paying customer company. Not tenant-scoped itself: it IS the tenant.
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    plan: { type: String, enum: ['free', 'pro', 'business', 'enterprise'], default: 'pro' },
    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled', 'none'],
      default: 'trialing'
    },
    trialEndsAt: Date,
    graceEndsAt: Date,
    currentPeriodEnd: Date,
    // Filled in Phase 2 (Razorpay Subscriptions)
    billing: {
      provider: { type: String, default: null },
      customerId: { type: String, default: null },
      subscriptionId: { type: String, default: null }
    },
    settings: {
      currency: { type: String, default: 'INR' },
      sizeUnit: { type: String, enum: ['mm', 'cm', 'in'], default: 'mm' },
      weightUnit: { type: String, enum: ['kg', 'lb'], default: 'kg' },
      defaultFreightCost: { type: Number, default: 120000 }
    }
  },
  { timestamps: true }
);

export default mongoose.model('Organization', organizationSchema);
