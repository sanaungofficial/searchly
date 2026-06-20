import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { FREE_AI_LIMIT } from "@/lib/usage";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const startOfMonth = new Date(`${currentMonth}-01T00:00:00Z`);

  const [users, jobs, subscriptions, monthlyUsageAgg, aiCostAgg, aiCostByFeature] = await Promise.all([
    prisma.user.findMany({
      include: {
        subscription: true,
        monthlyUsage: { where: { month: currentMonth } },
        _count: { select: { jobs: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({ select: { stage: true, createdAt: true } }),
    prisma.subscription.findMany({ select: { status: true } }),
    prisma.monthlyUsage.aggregate({
      where: { month: currentMonth },
      _sum: { count: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { inputTokens: true, outputTokens: true, costUsdMicros: true },
      _count: { _all: true },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costUsdMicros: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const subCounts = {
    active: subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
    trialing: subscriptions.filter((s) => s.status === SubscriptionStatus.TRIALING).length,
    canceled: subscriptions.filter((s) => s.status === SubscriptionStatus.CANCELED).length,
    pastDue: subscriptions.filter((s) => s.status === SubscriptionStatus.PAST_DUE).length,
  };

  const stageCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.stage] = (acc[j.stage] ?? 0) + 1;
    return acc;
  }, {});

  const usersWithResume = await prisma.profile.count({ where: { resumeUrl: { not: null } } });
  const usersWithCoverLetter = await prisma.job.count({ where: { coverLetter: { not: null } } });
  const usersWithFitAnalysis = await prisma.job.count({ where: { fitAnalysis: { not: null } } });

  const totalAiRequests = monthlyUsageAgg._sum.count ?? 0;
  const totalCostMicros = aiCostAgg._sum.costUsdMicros ?? 0;
  const totalInputTokens = aiCostAgg._sum.inputTokens ?? 0;
  const totalOutputTokens = aiCostAgg._sum.outputTokens ?? 0;
  const usersAtLimit = users.filter((u) => {
    if (u.subscription) return false;
    const used = u.monthlyUsage[0]?.count ?? 0;
    return used >= FREE_AI_LIMIT;
  }).length;

  return NextResponse.json({
    totalUsers: users.length,
    newUsersThisWeek: users.filter((u) => new Date(u.createdAt) >= sevenDaysAgo).length,
    newUsersThisMonth: users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length,
    totalJobs: jobs.length,
    usersWithJobs: users.filter((u) => u._count.jobs > 0).length,
    usersWithResume,
    usersWithCoverLetter,
    usersWithFitAnalysis,
    subCounts,
    stageCounts,
    currentMonth,
    aiStats: {
      totalAiRequests,
      usersAtLimit,
      totalCostMicros,
      totalInputTokens,
      totalOutputTokens,
      byFeature: aiCostByFeature.map((row) => ({
        feature: row.feature,
        calls: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        costMicros: row._sum.costUsdMicros ?? 0,
      })),
    },
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      jobCount: u._count.jobs,
      subscriptionStatus: u.subscription?.status ?? null,
      aiUsedThisMonth: u.monthlyUsage[0]?.count ?? 0,
    })),
  });
}
