import { JobActivitySignal, JobActivityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFollowUpSuggestions } from "@/lib/job-follow-up-suggestions";
import { isPromotionalInboxActivity } from "@/lib/kimchi-assistant/suggestion-questions";
import type { AssistantInboxSnapshot, AssistantSuggestion } from "@/lib/kimchi-assistant/types";

const SIGNAL_LABELS: Partial<Record<JobActivitySignal, string>> = {
  INTERVIEW_INVITE: "Interview invite",
  APPLICATION_RECEIVED: "Application update",
  REJECTION: "Decision",
  OFFER: "Offer",
  RECRUITER_OUTREACH: "Recruiter message",
  FOLLOW_UP: "Needs a reply",
  OTHER: "Job search email",
};

function inboxEmailActionLabel(a: {
  title: string | null;
  snippet: string | null;
  signal: string;
  companyGuess: string | null;
  roleGuess: string | null;
}): string {
  const subject = a.title?.trim();
  if (subject && subject.length > 4) {
    return subject.length > 52 ? `${subject.slice(0, 49)}…` : subject;
  }

  const signalLabel = SIGNAL_LABELS[a.signal as JobActivitySignal] ?? "Email update";
  if (a.roleGuess && a.companyGuess) {
    return `${signalLabel}: ${a.roleGuess} at ${a.companyGuess}`;
  }
  if (a.companyGuess) {
    return `${signalLabel} from ${a.companyGuess}`;
  }
  if (a.roleGuess) {
    return `${signalLabel}: ${a.roleGuess}`;
  }

  const snippet = a.snippet?.trim();
  if (snippet && snippet.length > 4) {
    return snippet.length > 52 ? `${snippet.slice(0, 49)}…` : snippet;
  }

  return signalLabel;
}

function inboxEmailDetail(a: {
  title: string | null;
  snippet: string | null;
  signal: string;
  companyGuess: string | null;
  roleGuess: string | null;
}): string {
  const signalLabel = SIGNAL_LABELS[a.signal as JobActivitySignal] ?? "Job search email";
  const parts: string[] = [signalLabel];
  if (a.companyGuess) parts.push(a.companyGuess);
  if (a.roleGuess) parts.push(a.roleGuess);
  const subject = a.title?.trim();
  if (subject) parts.push(`Subject: ${subject.slice(0, 80)}`);
  else if (a.snippet?.trim()) parts.push(a.snippet.trim().slice(0, 100));
  return parts.join(" · ");
}

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
      status: a.status,
      suggestedStage: a.suggestedStage,
      confidence: a.confidence,
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

function inboxEmailPriority(signal: string, confidence: number | null): number {
  switch (signal) {
    case "INTERVIEW_INVITE":
      return 94;
    case "OFFER":
      return 93;
    case "RECRUITER_OUTREACH":
      return 91;
    case "APPLICATION_RECEIVED":
      return 88;
    case "FOLLOW_UP":
      return 86;
    case "REJECTION":
      return 82;
    default:
      return (confidence ?? 0.5) >= 0.7 ? 78 : 60;
  }
}

export function inboxSuggestionsFromSnapshot(inbox: AssistantInboxSnapshot): AssistantSuggestion[] {
  const out: AssistantSuggestion[] = [];

  for (const a of inbox.activities.slice(0, 6)) {
    if (isPromotionalInboxActivity(a)) continue;
    out.push({
      id: `inbox-${a.id}`,
      kind: "inbox_email",
      title: inboxEmailActionLabel(a),
      detail: inboxEmailDetail(a),
      priority: inboxEmailPriority(a.signal, a.confidence),
      meta: { activityId: a.id, nylasMessageId: a.nylasMessageId ?? "" },
    });
  }

  for (const f of inbox.followUps.slice(0, 3)) {
    out.push({
      id: `follow-${f.jobId}`,
      kind: "follow_up",
      title: `Follow up: ${f.role}`,
      detail: `${f.company} — quiet ${f.daysQuiet} day${f.daysQuiet === 1 ? "" : "s"}. ${f.suggestion}`,
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
      route: "/networking",
      priority: 50,
    });
  }

  return out;
}
