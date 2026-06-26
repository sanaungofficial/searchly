import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { markPurchasePaid, markPurchaseRefunded } from "@/lib/coach-purchase";
import Stripe from "stripe";

// Stripe requires the raw body to verify signatures
export const runtime = "nodejs";

function toSubscriptionStatus(status: Stripe.Subscription.Status): string {
  return status.toUpperCase().replace(/-/g, "_");
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  const price = subscription.items.data[0]?.price;
  const periodEnd = new Date((subscription as any).current_period_end * 1000);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId: user.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id ?? "",
      stripeCurrentPeriodEnd: periodEnd,
      status: toSubscriptionStatus(subscription.status) as any,
    },
    update: {
      stripePriceId: price?.id ?? "",
      stripeCurrentPeriodEnd: periodEnd,
      status: toSubscriptionStatus(subscription.status) as any,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscription(subscription);
        } else if (session.mode === "payment" && session.metadata?.kind === "coach_purchase") {
          const purchaseId = session.metadata.purchaseId;
          if (purchaseId) {
            await markPurchasePaid({
              purchaseId,
              stripePaymentIntentId:
                typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
            });
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: "CANCELED" },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          const purchase = await prisma.coachPurchase.findFirst({
            where: { stripePaymentIntentId: paymentIntentId },
          });
          if (purchase) {
            const partial = charge.amount_refunded > 0 && charge.amount_refunded < charge.amount;
            await markPurchaseRefunded(purchase.id, partial);
          }
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
