import { JobActivityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFollowUpSuggestions } from "@/lib/job-follow-up-suggestions";
import type { AssistantInboxSnapshot, AssistantSuggestion } from "@/lib/kimchi-assistant/types";

export async function loadInboxSnapshot(userId: string): Promise<AssistantInboxSnapshot> {
  const [activities, followUps, pendingCount] = await Promise.all([
    prisma.jobActivityLog.findMany({
      where: { userId, status: JobActivityStatus.PENDING_REVIEW },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        job: { select: { id: true, company: true, role: true, stage: true } },
      },
    }),
    getFollowUpSuggestions(userId, 6),
    prisma.jobActivityLog.count({
      where: { userId, status: JobActivityStatus.PENDING_REVIEW },
    }),
  ]);

  return {
    pendingCount,
    emailConnected: activities.length > 0 || followUps.some((f) => f.lastMessageId),
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      snippet: a.snippet,
      signal: a.signal,
      companyGuess: a.companyGuess,
      roleGuess: a.roleGuess,
      nylasMessageId: a.nylasMessageId,
      job: a.job,
    })),
    followUps: followUps.map((f) => ({
      jobId: f.jobId,
      company: f.company,
      role: f.role,
      daysQuiet: f.daysQuiet,
      suggestion: f.suggestion,
      lastMessageId: f.lastMessageId,
    })),
  };
}

export function inboxSuggestionsFromSnapshot(inbox: AssistantInboxSnapshot): AssistantSuggestion[] {
  const out: AssistantSuggestion[] = [];

  for (const a of inbox.activities.slice(0, 4)) {
    const label = a.title || a.snippet || "New email about your search";
    const who = a.companyGuess || a.roleGuess || "Unknown company";
    out.push({
      id: `inbox-${a.id}`,
      kind: "inbox_email",
      title: "Review this email",
      detail: `${who} — ${label.slice(0, 120)}`,
      priority: 95,
      meta: { activityId: a.id, nylasMessageId: a.nylasMessageId ?? "" },
    });
  }

  for (const f of inbox.followUps.slice(0, 3)) {
    out.push({
      id: `follow-${f.jobId}`,
      kind: "follow_up",
      title: `Check in on ${f.role}`,
      detail: `${f.company} — ${f.suggestion}`,
      priority: 88,
      meta: { jobId: f.jobId, lastMessageId: f.lastMessageId ?? "" },
    });
  }

  if (!inbox.emailConnected && inbox.pendingCount === 0) {
    out.push({
      id: "connect-email",
      kind: "general",
      title: "Connect your email",
      detail: "Kimchi can spot interview invites and follow-ups from your inbox.",
      route: "/inbox",
      priority: 50,
    });
  }

  return out;
}
