import Stripe from "stripe";

function createStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-05-28.basil",
    typescript: true,
  });
}

// Lazy singleton — won't throw at module evaluation time (build-time)
let _stripe: Stripe | null = null;
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = createStripe();
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function isPro(subscription: {
  status: string;
  stripeCurrentPeriodEnd: Date;
} | null): boolean {
  if (!subscription) return false;
  const active = subscription.status === "ACTIVE" || subscription.status === "TRIALING";
  const notExpired = subscription.stripeCurrentPeriodEnd > new Date();
  return active && notExpired;
}
