import { JobActivitySignal, JobStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STALE_DAYS = 7;

const INBOUND_SIGNALS: JobActivitySignal[] = [
  JobActivitySignal.APPLICATION_RECEIVED,
  JobActivitySignal.INTERVIEW_INVITE,
  JobActivitySignal.OFFER,
  JobActivitySignal.REJECTION,
];

export type FollowUpSuggestion = {
  jobId: string;
  company: string;
  role: string;
  stage: JobStage;
  daysQuiet: number;
  suggestion: string;
  lastMessageId: string | null;
};

export async function getFollowUpSuggestions(userId: string, limit = 8): Promise<FollowUpSuggestion[]> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const now = Date.now();

  const jobs = await prisma.job.findMany({
    where: {
      userId,
      stage: { in: [JobStage.APPLIED, JobStage.APPLYING, JobStage.SCREENING] },
    },
    orderBy: { updatedAt: "asc" },
    take: 40,
  });

  const suggestions: FollowUpSuggestion[] = [];

  for (const job of jobs) {
    const anchor = job.appliedAt ?? job.updatedAt;
    if (anchor > cutoff) continue;

    const recentInbound = await prisma.jobActivityLog.findFirst({
      where: {
        userId,
        jobId: job.id,
        signal: { in: INBOUND_SIGNALS },
        createdAt: { gte: cutoff },
      },
    });
    if (recentInbound) continue;

    const lastThread = await prisma.jobActivityLog.findFirst({
      where: { userId, jobId: job.id, nylasMessageId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { nylasMessageId: true },
    });

    const daysQuiet = Math.max(1, Math.floor((now - anchor.getTime()) / (24 * 60 * 60 * 1000)));

    suggestions.push({
      jobId: job.id,
      company: job.company,
      role: job.role,
      stage: job.stage,
      daysQuiet,
      suggestion: `No update in ${daysQuiet} day${daysQuiet === 1 ? "" : "s"} — a brief follow-up may help.`,
      lastMessageId: lastThread?.nylasMessageId ?? null,
    });
  }

  return suggestions.slice(0, limit);
}
