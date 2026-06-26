import { JobActivitySignal, JobActivitySource, JobActivityStatus, JobStage, type Job } from "@prisma/client";
import { kimchiGenerateText } from "@/lib/llm";
import { extractJsonObject } from "@/lib/nylas-smart-compose";
import {
  fetchMessage,
  fetchRecentMessages,
  listMessages,
  messageFromLine,
  messagePlainText,
  type NylasMessage,
} from "@/lib/nylas-inbox";
import { prisma } from "@/lib/prisma";
import { getUserEmailGrant } from "@/lib/user-email-server";

const VALID_SIGNALS = new Set<string>([
  "APPLICATION_RECEIVED",
  "INTERVIEW_INVITE",
  "REJECTION",
  "OFFER",
  "RECRUITER_OUTREACH",
  "FOLLOW_UP",
  "OTHER",
]);

const SIGNAL_TO_STAGE: Partial<Record<JobActivitySignal, JobStage>> = {
  APPLICATION_RECEIVED: JobStage.APPLIED,
  INTERVIEW_INVITE: JobStage.INTERVIEWING,
  REJECTION: JobStage.REJECTED,
  OFFER: JobStage.OFFER,
  RECRUITER_OUTREACH: JobStage.SAVED,
};

function normalizeCompany(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchJob(jobs: Job[], company: string | null, role: string | null): Job | null {
  if (!company && !role) return null;
  const nc = normalizeCompany(company);
  const nr = (role ?? "").trim().toLowerCase();
  const scored = jobs
    .map((job) => {
      let score = 0;
      const jc = normalizeCompany(job.company);
      if (nc && jc && (jc.includes(nc) || nc.includes(jc))) score += 3;
      const jr = job.role.trim().toLowerCase();
      if (nr && jr && (jr.includes(nr) || nr.includes(jr))) score += 2;
      return { job, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.job ?? null;
}

async function classifyWithClaude(params: {
  userId: string;
  subject: string;
  from: string;
  snippet: string;
  jobs: Job[];
}): Promise<{
  signal: JobActivitySignal;
  suggestedStage: JobStage | null;
  confidence: number;
  company: string | null;
  role: string | null;
  title: string;
  snippet: string;
  interviewAt: Date | null;
  createJob: boolean;
} | null> {
  const pipeline = params.jobs
    .slice(0, 40)
    .map((j) => `- ${j.company} | ${j.role} | stage=${j.stage}`)
    .join("\n");

  const prompt = `Triage this job-search email. Return ONLY valid JSON:
{
  "signal": "APPLICATION_RECEIVED" | "INTERVIEW_INVITE" | "REJECTION" | "OFFER" | "RECRUITER_OUTREACH" | "FOLLOW_UP" | "OTHER",
  "suggestedStage": "SAVED" | "APPLYING" | "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN" | null,
  "confidence": 0.0-1.0,
  "company": string | null,
  "role": string | null,
  "title": string,
  "snippet": string (max 200 chars),
  "interviewAt": ISO8601 string | null,
  "createJob": boolean
}

Newsletters/marketing → OTHER, low confidence.

Pipeline:
${pipeline || "(empty)"}

From: ${params.from}
Subject: ${params.subject}
Snippet: ${params.snippet.slice(0, 200)}`;

  try {
    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 256,
      userId: params.userId,
      tags: ["feature:inbox-triage"],
    });
    const parsed = extractJsonObject(text);
    if (!parsed) return null;
    const signal = VALID_SIGNALS.has(String(parsed.signal))
      ? (parsed.signal as JobActivitySignal)
      : JobActivitySignal.OTHER;
    if (signal === JobActivitySignal.OTHER && Number(parsed.confidence ?? 0) < 0.5) return null;
    return {
      signal,
      suggestedStage: (parsed.suggestedStage as JobStage | null) ?? SIGNAL_TO_STAGE[signal] ?? null,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
      company: typeof parsed.company === "string" ? parsed.company : null,
      role: typeof parsed.role === "string" ? parsed.role : null,
      title: typeof parsed.title === "string" ? parsed.title : params.subject,
      snippet: typeof parsed.snippet === "string" ? parsed.snippet.slice(0, 200) : params.snippet.slice(0, 200),
      interviewAt: parsed.interviewAt ? new Date(String(parsed.interviewAt)) : null,
      createJob: Boolean(parsed.createJob),
    };
  } catch (err) {
    console.error("[mail/triage] classify", err);
    return null;
  }
}

async function recordActivity(params: {
  userId: string;
  message: NylasMessage;
  result: NonNullable<Awaited<ReturnType<typeof classifyWithClaude>>>;
  jobId: string | null;
}) {
  if (!params.message.id) return null;
  return prisma.jobActivityLog.upsert({
    where: { userId_nylasMessageId: { userId: params.userId, nylasMessageId: params.message.id } },
    create: {
      userId: params.userId,
      source: JobActivitySource.EMAIL,
      signal: params.result.signal,
      status: JobActivityStatus.PENDING_REVIEW,
      suggestedStage: params.result.suggestedStage,
      confidence: params.result.confidence,
      title: params.result.title,
      snippet: params.result.snippet,
      companyGuess: params.result.company,
      roleGuess: params.result.role,
      interviewAt: params.result.interviewAt,
      nylasMessageId: params.message.id,
      jobId: params.jobId,
    },
    update: {
      signal: params.result.signal,
      suggestedStage: params.result.suggestedStage,
      confidence: params.result.confidence,
      title: params.result.title,
      snippet: params.result.snippet,
      companyGuess: params.result.company,
      roleGuess: params.result.role,
      interviewAt: params.result.interviewAt,
      jobId: params.jobId ?? undefined,
    },
  });
}

async function processMessage(userId: string, grantId: string, message: NylasMessage, jobs: Job[]) {
  if (!message.id) return null;
  const full = message.snippet ? message : (await fetchMessage(grantId, message.id)) ?? message;
  const result = await classifyWithClaude({
    userId,
    subject: full.subject ?? "(no subject)",
    from: messageFromLine(full),
    snippet: full.snippet ?? messagePlainText(full).slice(0, 200),
    jobs,
  });
  if (!result) return null;
  const matched = matchJob(jobs, result.company, result.role);
  return recordActivity({ userId, message: full, result, jobId: matched?.id ?? null });
}

/** Run when user opens Kimchi chat — scans recent unread mail with Claude. */
export async function syncInboxOnChatOpen(userId: string): Promise<{
  connected: boolean;
  processed: number;
  pendingCount: number;
  summary: string;
}> {
  const grant = await getUserEmailGrant(userId);
  if (!grant?.nylasGrantId) {
    return { connected: false, processed: 0, pendingCount: 0, summary: "Inbox not connected." };
  }

  const jobs = await prisma.job.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  let messages: NylasMessage[] = [];
  try {
    const res = await listMessages(grant.nylasGrantId, { limit: 25 });
    messages = res.messages.filter((m) => m.unread !== false);
  } catch {
    try {
      messages = await fetchRecentMessages(grant.nylasGrantId, undefined, 15);
    } catch (err) {
      console.error("[mail/triage] list", err);
      return {
        connected: true,
        processed: 0,
        pendingCount: 0,
        summary: "Could not reach your inbox — try reconnecting Gmail.",
      };
    }
  }

  let processed = 0;
  for (const msg of messages.slice(0, 12)) {
    const row = await processMessage(userId, grant.nylasGrantId, msg, jobs);
    if (row) processed += 1;
  }

  await prisma.userEmailGrant.update({
    where: { userId },
    data: { lastSyncAt: new Date() },
  }).catch(() => {});

  const pendingCount = await prisma.jobActivityLog.count({
    where: { userId, status: JobActivityStatus.PENDING_REVIEW },
  });

  const summary =
    processed > 0
      ? `Checked ${messages.length} recent messages — ${processed} job-search updates to review.`
      : pendingCount > 0
        ? `${pendingCount} inbox updates waiting in chat suggestions.`
        : "No new job-search email updates since your last check.";

  return { connected: true, processed, pendingCount, summary };
}
