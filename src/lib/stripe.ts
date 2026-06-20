import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
  typescript: true,
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
