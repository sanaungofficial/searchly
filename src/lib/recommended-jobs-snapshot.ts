import { prisma } from "@/lib/prisma";
import {
  generateRecommendedJobsForUser,
  userEligibleForRecommendedSnapshot,
} from "@/lib/recommended-jobs-engine";
import {
  recommendedCronUserLimit,
  utcSnapshotDate,
  type RecommendedJobSnapshotPayload,
} from "@/lib/recommended-jobs-config";
import { sendRecommendedJobsDigestEmail } from "@/lib/recommended-jobs-email";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import { Prisma } from "@prisma/client";

export type RecommendedSnapshotCronSummary = {
  snapshotDate: string;
  usersConsidered: number;
  snapshotsWritten: number;
  snapshotsSkipped: number;
  emailsSent: number;
  errors: string[];
};

function parseSnapshotJobs(raw: unknown): VectorMatchedJob[] {
  if (!Array.isArray(raw)) return [];
  return raw as VectorMatchedJob[];
}

export async function persistRecommendedSnapshot(input: {
  userId: string;
  snapshotDate: string;
  payload: RecommendedJobSnapshotPayload;
  manualRefresh?: boolean;
}): Promise<void> {
  await prisma.recommendedJobSnapshot.upsert({
    where: {
      userId_snapshotDate: {
        userId: input.userId,
        snapshotDate: input.snapshotDate,
      },
    },
    create: {
      userId: input.userId,
      snapshotDate: input.snapshotDate,
      jobs: input.payload.jobs as unknown as Prisma.InputJsonValue,
      matchMode: input.payload.matchMode,
      companyCount: input.payload.companyCount,
      trackedWithMatches: input.payload.trackedWithMatches,
      jobCount: input.payload.jobs.length,
      manualRefresh: input.manualRefresh ?? false,
    },
    update: {
      jobs: input.payload.jobs as unknown as Prisma.InputJsonValue,
      matchMode: input.payload.matchMode,
      companyCount: input.payload.companyCount,
      trackedWithMatches: input.payload.trackedWithMatches,
      jobCount: input.payload.jobs.length,
      generatedAt: new Date(),
      manualRefresh: input.manualRefresh ?? false,
    },
  });
}

export async function readRecommendedSnapshot(
  userId: string,
  snapshotDate: string,
): Promise<(RecommendedJobSnapshotPayload & { generatedAt: Date }) | null> {
  const row = await prisma.recommendedJobSnapshot.findUnique({
    where: { userId_snapshotDate: { userId, snapshotDate } },
  });
  if (!row) return null;
  return {
    jobs: parseSnapshotJobs(row.jobs),
    matchMode: row.matchMode as RecommendedJobSnapshotPayload["matchMode"],
    companyCount: row.companyCount,
    trackedWithMatches: row.trackedWithMatches,
    generatedAt: row.generatedAt,
  };
}

export async function runRecommendedJobsSnapshotCron(): Promise<RecommendedSnapshotCronSummary> {
  const snapshotDate = utcSnapshotDate();
  const limit = recommendedCronUserLimit();
  const summary: RecommendedSnapshotCronSummary = {
    snapshotDate,
    usersConsidered: 0,
    snapshotsWritten: 0,
    snapshotsSkipped: 0,
    emailsSent: 0,
    errors: [],
  };

  const users = await prisma.user.findMany({
    where: {
      profile: {
        isNot: null,
      },
    },
    include: {
      profile: true,
      digestSettings: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit * 3,
  });

  const eligible: typeof users = [];
  for (const user of users) {
    if (eligible.length >= limit) break;
    const ok = await userEligibleForRecommendedSnapshot(user.id);
    if (ok) eligible.push(user);
  }

  summary.usersConsidered = eligible.length;

  for (const user of eligible) {
    try {
      const result = await generateRecommendedJobsForUser({
        userId: user.id,
        preferCache: true,
      });

      if (!result?.jobs.length) {
        summary.snapshotsSkipped += 1;
        continue;
      }

      await persistRecommendedSnapshot({
        userId: user.id,
        snapshotDate,
        payload: result,
      });
      summary.snapshotsWritten += 1;

      const settings =
        user.digestSettings ??
        (await prisma.userDigestSettings.create({
          data: { userId: user.id },
        }));

      if (!settings.dailyEmailEnabled) continue;

      const previousIds = new Set(settings.lastDigestJobIds ?? []);
      const newJobs = result.jobs.filter((j) => {
        const id = j.hirebaseId ?? j.url ?? `${j.companyName}:${j.title}`;
        return id && !previousIds.has(id);
      });

      if (!newJobs.length) continue;

      const sent = await sendRecommendedJobsDigestEmail({
        email: user.email,
        name: user.name,
        jobs: newJobs.slice(0, 5),
        totalNew: newJobs.length,
      });

      if (sent) {
        summary.emailsSent += 1;
        const allIds = result.jobs
          .map((j) => j.hirebaseId ?? j.url ?? `${j.companyName}:${j.title}`)
          .filter(Boolean) as string[];
        await prisma.userDigestSettings.update({
          where: { userId: user.id },
          data: {
            lastDigestSentAt: new Date(),
            lastDigestJobIds: allIds.slice(0, 100),
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${user.email}: ${msg}`);
    }
  }

  return summary;
}

export async function canManualRefresh(userId: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const settings = await prisma.userDigestSettings.findUnique({ where: { userId } });
  if (!settings?.lastManualRefreshAt) return { allowed: true };
  const elapsed = Date.now() - settings.lastManualRefreshAt.getTime();
  if (elapsed >= 4 * 60 * 60 * 1000) return { allowed: true };
  return { allowed: false, retryAfterMs: 4 * 60 * 60 * 1000 - elapsed };
}

export async function recordManualRefresh(userId: string): Promise<void> {
  await prisma.userDigestSettings.upsert({
    where: { userId },
    create: { userId, lastManualRefreshAt: new Date() },
    update: { lastManualRefreshAt: new Date() },
  });
}
