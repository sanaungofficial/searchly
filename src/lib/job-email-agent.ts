import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import {
  JobActivitySignal,
  JobActivitySource,
  JobActivityStatus,
  JobStage,
  type Job,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getJobAgentSettings } from "@/lib/job-agent-settings";
import {
  fetchEvent,
  fetchMessage,
  fetchRecentMessages,
  fetchUpcomingEvents,
  messageFromLine,
  messagePlainText,
  type NylasEvent,
  type NylasMessage,
} from "@/lib/nylas-inbox";


const AUTO_APPLY_CONFIDENCE = 0.72;

export type EmailSignalResult = {
  signal: JobActivitySignal;
  suggestedStage: JobStage | null;
  confidence: number;
  company: string | null;
  role: string | null;
  title: string;
  snippet: string;
  interviewAt: Date | null;
  createJob: boolean;
};

const SIGNAL_TO_STAGE: Partial<Record<JobActivitySignal, JobStage>> = {
  APPLICATION_RECEIVED: JobStage.APPLIED,
  INTERVIEW_INVITE: JobStage.INTERVIEWING,
  REJECTION: JobStage.REJECTED,
  OFFER: JobStage.OFFER,
  RECRUITER_OUTREACH: JobStage.SAVED,
  FOLLOW_UP: null as unknown as JobStage,
  OTHER: null as unknown as JobStage,
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

async function classifyEmailSignal(params: {
  userId: string;
  subject: string;
  from: string;
  body: string;
  jobs: Job[];
}): Promise<EmailSignalResult | null> {
  if (!isKimchiAiConfigured()) return null;

  const pipeline = params.jobs
    .slice(0, 40)
    .map((j) => `- ${j.company} | ${j.role} | stage=${j.stage}`)
    .join("\n");

  const prompt = `You analyze job-search emails for a candidate tracking applications in Kimchi.

Return ONLY valid JSON:
{
  "signal": "APPLICATION_RECEIVED" | "INTERVIEW_INVITE" | "REJECTION" | "OFFER" | "RECRUITER_OUTREACH" | "FOLLOW_UP" | "OTHER",
  "suggestedStage": "SAVED" | "APPLYING" | "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN" | null,
  "confidence": 0.0-1.0,
  "company": string | null,
  "role": string | null,
  "title": string,
  "snippet": string (max 200 chars, human-readable reason),
  "interviewAt": ISO8601 string | null,
  "createJob": boolean
}

Rules:
- Ignore newsletters, marketing, LinkedIn digests, and unrelated mail → signal OTHER, confidence low.
- Match company/role to the user's pipeline when possible.
- interviewAt only for scheduled interviews.

User pipeline:
${pipeline || "(empty)"}

Email:
From: ${params.from}
Subject: ${params.subject}
Body:
${params.body.slice(0, 6000)}`;

  const { text, usage, modelId } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 800,
    userId: params.userId,
    tags: ["feature:email-job-signal"],
  });

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return null;

  let parsed: {
    signal?: string;
    suggestedStage?: string | null;
    confidence?: number;
    company?: string | null;
    role?: string | null;
    title?: string;
    snippet?: string;
    interviewAt?: string | null;
    createJob?: boolean;
  };

  try {
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }

  const signal = (parsed.signal ?? "OTHER") as JobActivitySignal;
  if (signal === JobActivitySignal.OTHER && (parsed.confidence ?? 0) < 0.5) return null;

  await logAiUsage(
    params.userId,
    "EMAIL_JOB_SIGNAL",
    modelId,
    usage.inputTokens,
    usage.outputTokens,
  );

  const suggestedStage =
    (parsed.suggestedStage as JobStage | null) ??
    SIGNAL_TO_STAGE[signal] ??
    null;

  return {
    signal,
    suggestedStage,
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    company: parsed.company ?? null,
    role: parsed.role ?? null,
    title: parsed.title ?? params.subject,
    snippet: parsed.snippet ?? params.subject,
    interviewAt: parsed.interviewAt ? new Date(parsed.interviewAt) : null,
    createJob: Boolean(parsed.createJob),
  };
}

async function applySignalToPipeline(params: {
  userId: string;
  result: EmailSignalResult;
  jobs: Job[];
  autoApply: boolean;
}): Promise<{ jobId: string | null; appliedStage: JobStage | null }> {
  let job = matchJob(params.jobs, params.result.company, params.result.role);

  if (!job && params.result.createJob && params.result.company && params.autoApply) {
    job = await prisma.job.create({
      data: {
        userId: params.userId,
        company: params.result.company,
        role: params.result.role ?? "Role from email",
        stage: params.result.suggestedStage ?? JobStage.SAVED,
      },
    });
    params.jobs.push(job);
  }

  if (!job || !params.result.suggestedStage || !params.autoApply) {
    return { jobId: job?.id ?? null, appliedStage: null };
  }

  if (params.result.confidence < AUTO_APPLY_CONFIDENCE) {
    return { jobId: job.id, appliedStage: null };
  }

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      stage: params.result.suggestedStage,
      ...(params.result.suggestedStage === JobStage.APPLIED ? { appliedAt: new Date() } : {}),
    },
  });

  return { jobId: updated.id, appliedStage: updated.stage };
}

async function recordActivity(params: {
  userId: string;
  source: JobActivitySource;
  result: EmailSignalResult;
  jobId: string | null;
  appliedStage: JobStage | null;
  autoApply: boolean;
  nylasMessageId?: string;
  nylasEventId?: string;
  rawPayload?: unknown;
}) {
  const status =
    params.appliedStage != null
      ? JobActivityStatus.APPLIED
      : params.autoApply && params.result.confidence >= AUTO_APPLY_CONFIDENCE
        ? JobActivityStatus.PENDING_REVIEW
        : JobActivityStatus.PENDING_REVIEW;

  const data = {
    userId: params.userId,
    jobId: params.jobId,
    source: params.source,
    signal: params.result.signal,
    suggestedStage: params.result.suggestedStage,
    appliedStage: params.appliedStage,
    status,
    confidence: params.result.confidence,
    title: params.result.title,
    snippet: params.result.snippet,
    companyGuess: params.result.company,
    roleGuess: params.result.role,
    interviewAt: params.result.interviewAt,
    nylasMessageId: params.nylasMessageId ?? null,
    nylasEventId: params.nylasEventId ?? null,
    rawPayload: params.rawPayload as object | undefined,
  };

  if (params.nylasMessageId) {
    return prisma.jobActivityLog.upsert({
      where: { userId_nylasMessageId: { userId: params.userId, nylasMessageId: params.nylasMessageId } },
      create: data,
      update: data,
    });
  }

  if (params.nylasEventId) {
    return prisma.jobActivityLog.upsert({
      where: { userId_nylasEventId: { userId: params.userId, nylasEventId: params.nylasEventId } },
      create: data,
      update: data,
    });
  }

  return prisma.jobActivityLog.create({ data });
}

async function processMessageForUser(userId: string, grantId: string, message: NylasMessage) {
  const settings = await getJobAgentSettings(userId);
  if (!settings.enabled) return null;

  const existing = message.id
    ? await prisma.jobActivityLog.findUnique({
        where: { userId_nylasMessageId: { userId, nylasMessageId: message.id } },
      })
    : null;
  if (existing) return existing;

  const jobs = await prisma.job.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  const full = message.body ? message : (await fetchMessage(grantId, message.id)) ?? message;

  const result = await classifyEmailSignal({
    userId,
    subject: full.subject ?? "(no subject)",
    from: messageFromLine(full),
    body: messagePlainText(full),
    jobs,
  });

  if (!result) return null;

  const { jobId, appliedStage } = await applySignalToPipeline({
    userId,
    result,
    jobs,
    autoApply: settings.autoApplyUpdates,
  });

  return recordActivity({
    userId,
    source: JobActivitySource.EMAIL,
    result,
    jobId,
    appliedStage,
    autoApply: settings.autoApplyUpdates,
    nylasMessageId: message.id,
    rawPayload: full,
  });
}

async function processEventForUser(userId: string, grantId: string, event: NylasEvent) {
  const settings = await getJobAgentSettings(userId);
  if (!settings.enabled) return null;

  const title = event.title ?? "";
  const desc = event.description ?? "";
  const combined = `${title}\n${desc}`.toLowerCase();
  const looksInterview =
    /interview|screen|recruiter|hiring|onsite|phone screen|technical|culture fit|meet with/i.test(combined);

  if (!looksInterview) return null;

  const jobs = await prisma.job.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  const start = event.when?.start_time ? new Date(event.when.start_time * 1000) : null;

  const result: EmailSignalResult = {
    signal: JobActivitySignal.INTERVIEW_INVITE,
    suggestedStage: JobStage.INTERVIEWING,
    confidence: 0.8,
    company: null,
    role: null,
    title: title || "Interview on calendar",
    snippet: `Calendar event: ${title}${start ? ` · ${start.toLocaleString()}` : ""}`,
    interviewAt: start,
    createJob: false,
  };

  for (const job of jobs) {
    const nc = normalizeCompany(job.company);
    if (nc && combined.includes(nc.replace(/[^a-z0-9]/g, ""))) {
      result.company = job.company;
      result.role = job.role;
      result.confidence = 0.88;
      break;
    }
  }

  const { jobId, appliedStage } = await applySignalToPipeline({
    userId,
    result,
    jobs,
    autoApply: settings.autoApplyUpdates,
  });

  return recordActivity({
    userId,
    source: JobActivitySource.CALENDAR,
    result,
    jobId,
    appliedStage,
    autoApply: settings.autoApplyUpdates,
    nylasEventId: event.id,
    rawPayload: event,
  });
}

export async function syncUserInbox(userId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { userId } });
  if (!grant) return { processed: 0 };

  const since = grant.lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let processed = 0;

  const messages = await fetchRecentMessages(grant.nylasGrantId, since, 25);
  for (const msg of messages) {
    try {
      const log = await processMessageForUser(userId, grant.nylasGrantId, msg);
      if (log) processed += 1;
    } catch (err) {
      console.error("[job-email-agent] message", userId, msg.id, err);
    }
  }

  const events = await fetchUpcomingEvents(grant.nylasGrantId, 21);
  for (const ev of events) {
    try {
      const log = await processEventForUser(userId, grant.nylasGrantId, ev);
      if (log) processed += 1;
    } catch (err) {
      console.error("[job-email-agent] event", userId, ev.id, err);
    }
  }

  await prisma.userEmailGrant.update({
    where: { id: grant.id },
    data: { lastSyncAt: new Date() },
  });

  return { processed };
}

export async function processUserMessageWebhook(grantId: string, messageId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { nylasGrantId: grantId } });
  if (!grant) return null;

  const message = await fetchMessage(grantId, messageId);
  if (!message) return null;

  return processMessageForUser(grant.userId, grantId, message);
}

export async function processUserEventWebhook(grantId: string, eventId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { nylasGrantId: grantId } });
  if (!grant) return null;

  const event = await fetchEvent(grantId, eventId);
  if (!event) return null;

  return processEventForUser(grant.userId, grantId, event);
}

export async function syncAllUserInboxes() {
  const grants = await prisma.userEmailGrant.findMany({
    include: { user: { include: { jobAgentSettings: true } } },
  });

  let total = 0;
  for (const grant of grants) {
    if (grant.user.jobAgentSettings && !grant.user.jobAgentSettings.enabled) continue;
    try {
      const { processed } = await syncUserInbox(grant.userId);
      total += processed;
    } catch (err) {
      console.error("[job-email-agent] sync", grant.userId, err);
    }
  }
  return { users: grants.length, processed: total };
}
