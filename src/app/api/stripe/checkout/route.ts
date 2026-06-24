import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { BillingInterval } from "@/lib/plan-config";
import { resolveStripePriceId } from "@/lib/plan-config";

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let interval: BillingInterval = "monthly";
  try {
    const body = await req.json();
    if (body?.interval === "weekly" || body?.interval === "monthly" || body?.interval === "quarterly") {
      interval = body.interval;
    }
  } catch {
    // default monthly
  }

  const priceId = resolveStripePriceId(interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not configured for ${interval}. Set ${interval === "monthly" ? "STRIPE_PRICE_ID" : `STRIPE_PRICE_ID_${interval.toUpperCase()}`}.` },
      { status: 503 },
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = dbUser.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser.email,
      name: dbUser.name ?? undefined,
      metadata: { userId: dbUser.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?upgraded=true`,
    cancel_url: `${baseUrl}/dashboard?pricing=1`,
    metadata: { userId: dbUser.id, interval },
  });

  return NextResponse.json({ url: session.url });
}
