import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SubscriptionStatus } from "@prisma/client";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, jobs, subscriptions] = await Promise.all([
    prisma.user.findMany({
      include: { subscription: true, _count: { select: { jobs: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({ select: { stage: true, createdAt: true } }),
    prisma.subscription.findMany({ select: { status: true } }),
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
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      jobCount: u._count.jobs,
      subscriptionStatus: u.subscription?.status ?? null,
    })),
  });
}
