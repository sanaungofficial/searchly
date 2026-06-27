import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { CoachPurchaseLeadSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  buyerLifetimeCoachSpendCents,
  loadPackageForCheckout,
  resolvePackageQuote,
} from "@/lib/coach-purchase";

function parseLeadSource(raw: unknown): CoachPurchaseLeadSource {
  if (raw === "SALES_ASSISTED") return CoachPurchaseLeadSource.SALES_ASSISTED;
  if (raw === "COACH_REFERRAL") return CoachPurchaseLeadSource.COACH_REFERRAL;
  if (raw === "DIRECT_LINK") return CoachPurchaseLeadSource.DIRECT_LINK;
  return CoachPurchaseLeadSource.MARKETPLACE;
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured on this environment." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    packageId?: string;
    coachProfileId?: string;
    leadSource?: string;
    salesAssisted?: boolean;
  };

  if (!body.packageId || !body.coachProfileId) {
    return NextResponse.json({ error: "packageId and coachProfileId are required" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const row = await loadPackageForCheckout(body.packageId, body.coachProfileId);
  if (!row) return NextResponse.json({ error: "Package not found or not offered" }, { status: 404 });

  const leadSource = parseLeadSource(body.leadSource);
  const lifetimeSpend = await buyerLifetimeCoachSpendCents(dbUser.id);
  const quote = resolvePackageQuote({
    pkg: row,
    hourlyRate: row.coachProfile.hourlyRate,
    bulkDiscounts: row.coachProfile.bulkDiscounts,
    packagesSyncToHourly: row.coachProfile.packagesSyncToHourly,
    buyerLifetimeSpendCents: lifetimeSpend,
    leadSource,
    salesAssisted: body.salesAssisted,
  });

  if (!quote) {
    return NextResponse.json(
      { error: "This package is not purchasable yet — coach needs to set an hourly rate and price." },
      { status: 400 },
    );
  }

  let customerId = dbUser.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser.email,
      name: dbUser.name ?? undefined,
      metadata: { userId: dbUser.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: dbUser.id }, data: { stripeCustomerId: customerId } });
  }

  const purchase = await prisma.coachPurchase.create({
    data: {
      coachProfileId: row.coachProfileId,
      buyerUserId: dbUser.id,
      packageId: row.id,
      packageTitle: quote.title,
      packageHours: quote.hours,
      packageHoursMax: quote.hoursMax,
      amountCents: quote.amountCents,
      platformFeeCents: quote.platformFeeCents,
      stripeFeeCents: quote.stripeFeeCents,
      coachPayoutCents: quote.coachPayoutCents,
      hoursGranted: quote.hoursGranted,
      hoursRemaining: quote.hoursGranted,
      leadSource,
      salesAssisted: leadSource === CoachPurchaseLeadSource.SALES_ASSISTED || Boolean(body.salesAssisted),
      buyerEmail: dbUser.email,
      buyerName: dbUser.name,
      status: "PENDING",
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";
  const coachSlug = row.coachProfile.slug;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: quote.amountCents,
          product_data: {
            name: quote.title,
            description: `${row.coachProfile.displayName} · ${quote.hoursGranted} coaching hour${quote.hoursGranted === 1 ? "" : "s"}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard?purchase=success&coach=${encodeURIComponent(coachSlug ?? "")}`,
    cancel_url: coachSlug
      ? `${baseUrl}/coach/${coachSlug}?purchase=canceled`
      : `${baseUrl}/coaching?purchase=canceled`,
    metadata: {
      kind: "coach_purchase",
      purchaseId: purchase.id,
      coachProfileId: row.coachProfileId,
      packageId: row.id,
      userId: dbUser.id,
    },
  });

  await prisma.coachPurchase.update({
    where: { id: purchase.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return NextResponse.json({ url: session.url, purchaseId: purchase.id });
}
