import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const STORAGE_BUCKETS = ["resumes", "avatars"] as const;
const MAX_STORAGE_OBJECTS = 10_000;

export type AnthropicUsageStats = {
  costThisMonth: number;
  callsThisMonth: number;
  tokensInThisMonth: number;
  tokensOutThisMonth: number;
  costTotal: number;
  callsTotal: number;
  tokensInTotal: number;
  tokensOutTotal: number;
  byFeature: Array<{ feature: string; calls: number; costUsd: number; tokensIn: number; tokensOut: number }>;
  byModel: Array<{ model: string; calls: number; costUsd: number; tokensIn: number; tokensOut: number }>;
  dailyLast30Days: Array<{ date: string; calls: number; costUsd: number }>;
  topUsersThisMonth: Array<{
    userId: string;
    name: string | null;
    email: string;
    calls: number;
    costUsd: number;
  }>;
};

export type SupabaseUsageStats = {
  authUsers: number;
  storage: {
    totalBytes: number;
    totalObjects: number;
    byBucket: Array<{ bucket: string; bytes: number; objects: number }>;
  };
  database: {
    users: number;
    profiles: number;
    jobs: number;
    assets: number;
    aiUsageLogs: number;
    companyIntel: number;
  };
  estimate: {
    planMonthlyUsd: number;
    includedStorageGb: number;
    storageUsedGb: number;
    storageOverageGb: number;
    storageOverageUsd: number;
    estimatedMonthlyUsd: number;
    note: string;
  };
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function roundUsd(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function scanStoragePrefix(
  bucket: string,
  prefix: string,
  depth: number,
  state: { bytes: number; objects: number },
): Promise<void> {
  if (depth > 6 || state.objects >= MAX_STORAGE_OBJECTS) return;

  const admin = getSupabaseAdmin();
  let offset = 0;
  const limit = 200;

  while (state.objects < MAX_STORAGE_OBJECTS) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data?.length) break;

    for (const item of data) {
      if (state.objects >= MAX_STORAGE_OBJECTS) break;
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null) {
        await scanStoragePrefix(bucket, path, depth + 1, state);
      } else {
        state.bytes += item.metadata?.size ?? 0;
        state.objects += 1;
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
}

async function getSupabaseStorageStats(): Promise<SupabaseUsageStats["storage"]> {
  const byBucket: SupabaseUsageStats["storage"]["byBucket"] = [];
  let totalBytes = 0;
  let totalObjects = 0;

  for (const bucket of STORAGE_BUCKETS) {
    const state = { bytes: 0, objects: 0 };
    try {
      await scanStoragePrefix(bucket, "", 0, state);
    } catch (err) {
      console.error("[admin-usage-stats] storage scan", bucket, err);
    }
    byBucket.push({ bucket, bytes: state.bytes, objects: state.objects });
    totalBytes += state.bytes;
    totalObjects += state.objects;
  }

  return { totalBytes, totalObjects, byBucket };
}

async function countSupabaseAuthUsers(): Promise<number> {
  const admin = getSupabaseAdmin();
  let total = 0;
  let page = 1;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    total += data.users.length;
    if (data.users.length < 200) break;
    page += 1;
  }

  return total;
}

export async function getAnthropicUsageStats(): Promise<AnthropicUsageStats> {
  const monthStart = startOfMonth();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    monthAgg,
    totalAgg,
    byFeature,
    byModel,
    recentLogs,
    topUsersRaw,
  ] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costUsd: true, tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.aiUsageLog.aggregate({
      _sum: { costUsd: true, tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["feature"],
      _sum: { costUsd: true, tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["model"],
      _sum: { costUsd: true, tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, costUsd: true },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { costUsd: true },
      _count: true,
      orderBy: { _sum: { costUsd: "desc" } },
      take: 8,
    }),
  ]);

  const dailyMap = new Map<string, { calls: number; costUsd: number }>();
  for (const log of recentLogs) {
    const key = dayKey(log.createdAt);
    const entry = dailyMap.get(key) ?? { calls: 0, costUsd: 0 };
    entry.calls += 1;
    entry.costUsd += log.costUsd;
    dailyMap.set(key, entry);
  }

  const dailyLast30Days = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, calls: v.calls, costUsd: roundUsd(v.costUsd) }));

  const userIds = topUsersRaw.map((r) => r.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return {
    costThisMonth: roundUsd(monthAgg._sum.costUsd ?? 0),
    callsThisMonth: monthAgg._count,
    tokensInThisMonth: monthAgg._sum.tokensIn ?? 0,
    tokensOutThisMonth: monthAgg._sum.tokensOut ?? 0,
    costTotal: roundUsd(totalAgg._sum.costUsd ?? 0),
    callsTotal: totalAgg._count,
    tokensInTotal: totalAgg._sum.tokensIn ?? 0,
    tokensOutTotal: totalAgg._sum.tokensOut ?? 0,
    byFeature: byFeature
      .map((f) => ({
        feature: f.feature,
        calls: f._count,
        costUsd: roundUsd(f._sum.costUsd ?? 0),
        tokensIn: f._sum.tokensIn ?? 0,
        tokensOut: f._sum.tokensOut ?? 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byModel: byModel
      .map((m) => ({
        model: m.model,
        calls: m._count,
        costUsd: roundUsd(m._sum.costUsd ?? 0),
        tokensIn: m._sum.tokensIn ?? 0,
        tokensOut: m._sum.tokensOut ?? 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    dailyLast30Days,
    topUsersThisMonth: topUsersRaw.map((row) => {
      const u = userById.get(row.userId);
      return {
        userId: row.userId,
        name: u?.name ?? null,
        email: u?.email ?? row.userId,
        calls: row._count,
        costUsd: roundUsd(row._sum.costUsd ?? 0),
      };
    }),
  };
}

export async function getSupabaseUsageStats(): Promise<SupabaseUsageStats> {
  const planMonthlyUsd = Number(process.env.SUPABASE_PLAN_MONTHLY_USD ?? 25);
  const includedStorageGb = Number(process.env.SUPABASE_INCLUDED_STORAGE_GB ?? 100);
  const storagePerGbUsd = Number(process.env.SUPABASE_STORAGE_USD_PER_GB ?? 0.021);

  const [storage, authUsers, dbUsers, dbProfiles, dbJobs, dbAssets, dbAiLogs, dbIntel] =
    await Promise.all([
      getSupabaseStorageStats(),
      countSupabaseAuthUsers(),
      prisma.user.count(),
      prisma.profile.count(),
      prisma.job.count(),
      prisma.userAsset.count(),
      prisma.aiUsageLog.count(),
      prisma.companyIntel.count(),
    ]);

  const storageUsedGb = storage.totalBytes / 1024 ** 3;
  const storageOverageGb = Math.max(0, storageUsedGb - includedStorageGb);
  const storageOverageUsd = storageOverageGb * storagePerGbUsd;

  return {
    authUsers,
    storage,
    database: {
      users: dbUsers,
      profiles: dbProfiles,
      jobs: dbJobs,
      assets: dbAssets,
      aiUsageLogs: dbAiLogs,
      companyIntel: dbIntel,
    },
    estimate: {
      planMonthlyUsd,
      includedStorageGb,
      storageUsedGb: Math.round(storageUsedGb * 1000) / 1000,
      storageOverageGb: Math.round(storageOverageGb * 1000) / 1000,
      storageOverageUsd: roundUsd(storageOverageUsd),
      estimatedMonthlyUsd: roundUsd(planMonthlyUsd + storageOverageUsd),
      note:
        "Estimate uses SUPABASE_PLAN_MONTHLY_USD and storage overage only. Check the Supabase dashboard for exact billing (DB, egress, MAU).",
    },
  };
}

export async function getAdminUsageStats() {
  const [anthropic, supabase] = await Promise.all([
    getAnthropicUsageStats(),
    getSupabaseUsageStats(),
  ]);
  return { anthropic, supabase, generatedAt: new Date().toISOString() };
}
