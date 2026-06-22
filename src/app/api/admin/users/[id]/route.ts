import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const [dbUser, aiSummary, featureBreakdown] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: {
          profile: { select: { resumeUrl: true, linkedinUrl: true, headline: true, targetRoles: true, targetSalary: true, createdAt: true } },
          jobs: { orderBy: { createdAt: "desc" }, select: { id: true, company: true, role: true, stage: true, coverLetter: true, fitAnalysis: true, appliedAt: true, createdAt: true } },
          subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
          tailoredResumes: { select: { id: true } },
        },
      }),
      prisma.aiUsageLog.aggregate({
        where: { userId: id },
        _sum: { costUsd: true, tokensIn: true, tokensOut: true },
        _count: true,
      }),
      prisma.aiUsageLog.groupBy({
        by: ["feature"],
        where: { userId: id },
        _count: { _all: true },
        _sum: { costUsd: true },
      }),
    ]);

    if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...dbUser,
      aiSummary: {
        totalCalls: aiSummary._count,
        totalCostUsd: aiSummary._sum.costUsd ?? 0,
        totalTokensIn: aiSummary._sum.tokensIn ?? 0,
        totalTokensOut: aiSummary._sum.tokensOut ?? 0,
        byFeature: featureBreakdown.map((f) => ({ feature: f.feature, calls: f._count._all, costUsd: f._sum.costUsd ?? 0 })),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/users/[id] GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const update: { name?: string | null; role?: UserRole } = {};
  if ("name" in body) update.name = body.name?.trim() || null;
  if ("role" in body && Object.values(UserRole).includes(body.role)) update.role = body.role;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id }, data: update });
  return NextResponse.json(updated);
}
