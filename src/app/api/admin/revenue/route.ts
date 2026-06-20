import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  const [activeSubs, trialingSubs, recentInvoices, canceledRecent, aiCostThisMonth, aiCostTotal, aiFeatureBreakdown] = await Promise.all([
    stripe.subscriptions.list({ status: "active", limit: 100 }),
    stripe.subscriptions.list({ status: "trialing", limit: 100 }),
    stripe.invoices.list({ status: "paid", limit: 100, created: { gte: startOfMonth } }),
    stripe.subscriptions.list({ status: "canceled", limit: 100, created: { gte: thirtyDaysAgo } }),
    prisma.aiUsageLog.aggregate({ where: { createdAt: { gte: new Date(startOfMonth * 1000) } }, _sum: { costUsd: true }, _count: true }),
    prisma.aiUsageLog.aggregate({ _sum: { costUsd: true }, _count: true }),
    prisma.aiUsageLog.groupBy({ by: ["feature"], _sum: { costUsd: true }, _count: true }),
  ]);

  // Compute MRR: sum monthly-equivalent amounts
  const allActiveSubs = [...activeSubs.data, ...trialingSubs.data];
  let mrr = 0;
  for (const sub of allActiveSubs) {
    const item = sub.items.data[0];
    if (!item?.price) continue;
    const amount = item.price.unit_amount ?? 0;
    const interval = item.price.recurring?.interval;
    const factor = interval === "year" ? 1 / 12 : interval === "week" ? 4 : 1;
    mrr += (amount * factor) / 100;
  }

  const revenueThisMonth = recentInvoices.data.reduce((sum, inv) => sum + inv.amount_paid / 100, 0);

  return NextResponse.json({
    mrr: Math.round(mrr * 100) / 100,
    revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
    activeSubscribers: activeSubs.data.length,
    trialingSubscribers: trialingSubs.data.length,
    churnedThisMonth: canceledRecent.data.length,
    ai: {
      costThisMonth: Math.round((aiCostThisMonth._sum.costUsd ?? 0) * 10000) / 10000,
      callsThisMonth: aiCostThisMonth._count,
      costTotal: Math.round((aiCostTotal._sum.costUsd ?? 0) * 10000) / 10000,
      callsTotal: aiCostTotal._count,
      byFeature: aiFeatureBreakdown.map((f) => ({
        feature: f.feature,
        calls: f._count,
        costUsd: Math.round((f._sum.costUsd ?? 0) * 10000) / 10000,
      })),
    },
  });
}
