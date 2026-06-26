import { digestUnsubscribeUrl } from "@/lib/digest-unsubscribe";
import {
  canSendDigestEmailTo,
  digestEmailAllowlist,
  isDigestEmailLive,
} from "@/lib/digest-email-live";
import { prisma } from "@/lib/prisma";
import { readRecommendedSnapshot } from "@/lib/recommended-jobs-snapshot";
import {
  buildRecommendedJobsDigestEmail,
  sendRecommendedJobsDigestEmail,
} from "@/lib/recommended-jobs-email";
import { sampleDigestPreviewJobs } from "@/lib/recommended-jobs-email-samples";
import {
  recommendedDigestMinScore,
  RECOMMENDED_DIGEST_EMAIL_MAX_JOBS,
  utcSnapshotDate,
} from "@/lib/recommended-jobs-config";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

export type DigestJobSource = "snapshot" | "generated" | "sample";

export async function resolveDigestJobsForAdmin(
  userId: string,
  preferSample = false,
): Promise<{ jobs: VectorMatchedJob[]; source: DigestJobSource; totalNew: number }> {
  if (preferSample) {
    const jobs = sampleDigestPreviewJobs();
    return { jobs, source: "sample", totalNew: jobs.length };
  }

  const snapshotDate = utcSnapshotDate();
  const snapshot = await readRecommendedSnapshot(userId, snapshotDate);
  let jobs: VectorMatchedJob[] = snapshot?.jobs ?? [];
  let source: DigestJobSource = snapshot?.jobs.length ? "snapshot" : "generated";

  if (!jobs.length) {
    const { generateRecommendedJobsForUser } = await import("@/lib/recommended-jobs-engine");
    const generated = await generateRecommendedJobsForUser({
      userId,
      preferCache: true,
    });
    jobs = generated?.jobs ?? [];
    source = "generated";
  }

  if (!jobs.length) {
    const sample = sampleDigestPreviewJobs();
    return { jobs: sample, source: "sample", totalNew: sample.length };
  }

  const topJobs = [...jobs]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, RECOMMENDED_DIGEST_EMAIL_MAX_JOBS);

  return { jobs: topJobs, source, totalNew: topJobs.length };
}

export function digestEmailAdminStatus() {
  const allowlist = [...digestEmailAllowlist()];
  return {
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    hirebaseConfigured: Boolean(process.env.HIREBASE_API_KEY),
    digestMinScore: recommendedDigestMinScore(),
    cronSchedule: "0 8 * * * UTC (daily 8:00 UTC)",
    maxJobsPerEmail: RECOMMENDED_DIGEST_EMAIL_MAX_JOBS,
    liveMode: isDigestEmailLive(),
    allowlist,
    automatedSendingEnabled: isDigestEmailLive() || allowlist.length > 0,
  };
}

export async function previewDigestEmailForAdmin(userId: string, name: string | null, useSample = false) {
  const { jobs, source, totalNew } = await resolveDigestJobsForAdmin(userId, useSample);
  const content = buildRecommendedJobsDigestEmail({
    name,
    jobs,
    totalNew,
    unsubscribeUrl: digestUnsubscribeUrl(userId),
  });
  return { ...content, jobs, source, totalNew };
}

export async function sendDigestEmailForAdmin(input: {
  userId: string;
  name: string | null;
  to: string;
  useSample?: boolean;
}) {
  const { jobs, source, totalNew } = await resolveDigestJobsForAdmin(input.userId, input.useSample);
  const sent = await sendRecommendedJobsDigestEmail({
    email: input.to,
    name: input.name,
    jobs,
    totalNew,
    unsubscribeUrl: digestUnsubscribeUrl(input.userId),
  });
  return { sent, jobs, source, totalNew };
}

/** Cron path — respects live gate and optional allowlist. */
export function shouldSendAutomatedDigest(email: string): boolean {
  return canSendDigestEmailTo(email);
}

export async function getDigestSettingsSummary() {
  const [enabledCount, sentToday] = await Promise.all([
    prisma.userDigestSettings.count({ where: { dailyEmailEnabled: true } }),
    prisma.userDigestSettings.count({
      where: {
        lastDigestSentAt: {
          gte: new Date(new Date().toISOString().slice(0, 10)),
        },
      },
    }),
  ]);
  return { enabledCount, sentToday };
}
