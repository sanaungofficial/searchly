import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CoachPurchaseStatus } from "@prisma/client";
import { serializeAdminPurchase } from "@/lib/coach-purchase";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const coachId = sp.get("coachId") ?? undefined;
  const statusParam = sp.get("status") ?? undefined;
  const salesAssisted = sp.get("salesAssisted") === "true" ? true : sp.get("salesAssisted") === "false" ? false : undefined;
  const q = sp.get("q")?.trim().toLowerCase();
  const limit = Math.min(Number(sp.get("limit") ?? 200), 500);

  const status =
    statusParam && Object.values(CoachPurchaseStatus).includes(statusParam as CoachPurchaseStatus)
      ? (statusParam as CoachPurchaseStatus)
      : undefined;

  const purchases = await prisma.coachPurchase.findMany({
    where: {
      ...(coachId ? { coachProfileId: coachId } : {}),
      ...(status ? { status } : {}),
      ...(salesAssisted != null ? { salesAssisted } : {}),
      ...(q
        ? {
            OR: [
              { buyerEmail: { contains: q, mode: "insensitive" } },
              { buyerName: { contains: q, mode: "insensitive" } },
              { packageTitle: { contains: q, mode: "insensitive" } },
              { coachProfile: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      coachProfile: { select: { id: true, displayName: true, slug: true } },
      buyer: { select: { email: true, name: true } },
    },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [paidAgg, monthAgg, refundCount, pendingPayoutAgg] = await Promise.all([
    prisma.coachPurchase.aggregate({
      where: { status: CoachPurchaseStatus.PAID },
      _sum: { amountCents: true, coachPayoutCents: true, platformFeeCents: true },
      _count: true,
    }),
    prisma.coachPurchase.aggregate({
      where: { status: CoachPurchaseStatus.PAID, paidAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.coachPurchase.count({
      where: { status: { in: [CoachPurchaseStatus.REFUNDED, CoachPurchaseStatus.PARTIALLY_REFUNDED] } },
    }),
    prisma.coachPurchase.aggregate({
      where: { status: CoachPurchaseStatus.PAID },
      _sum: { coachPayoutCents: true },
    }),
  ]);

  return NextResponse.json({
    stats: {
      totalVolumeCents: paidAgg._sum.amountCents ?? 0,
      totalPurchases: paidAgg._count,
      monthVolumeCents: monthAgg._sum.amountCents ?? 0,
      monthPurchases: monthAgg._count,
      platformRevenueCents: paidAgg._sum.platformFeeCents ?? 0,
      coachPayoutsCents: pendingPayoutAgg._sum.coachPayoutCents ?? 0,
      refundCount,
    },
    purchases: purchases.map(serializeAdminPurchase),
  });
}
