import { JobStage } from "@prisma/client";
import { kimchiGenerateText } from "@/lib/llm";
import {
  fetchMessage,
  fetchUpcomingEvents,
  formatMessageDate,
  listMessages,
  messageFromLine,
  messagePlainText,
  sendMessage,
  serializeMessageSummary,
} from "@/lib/nylas-inbox";
import { prisma } from "@/lib/prisma";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { logOutboundSend } from "@/lib/inbox-crm";

export type MailToolResult = { ok: true; data: unknown } | { ok: false; error: string };

async function requireGrant(userId: string) {
  const grant = await getUserEmailGrant(userId);
  if (!grant?.nylasGrantId) {
    return { error: "Inbox not connected — connect Gmail or Outlook from Inbox or Profile." as const, grant: null };
  }
  return { grant, error: null as null };
}

export async function mailListRecent(
  userId: string,
  opts?: { limit?: number; query?: string },
): Promise<MailToolResult> {
  const { grant, error } = await requireGrant(userId);
  if (error || !grant) return { ok: false, error: error ?? "Inbox not connected" };

  const limit = Math.min(Math.max(opts?.limit ?? 5, 1), 20);
  try {
    const { messages } = await listMessages(grant.nylasGrantId, {
      limit,
      searchQueryNative: opts?.query?.trim() || undefined,
    });
    return {
      ok: true,
      data: {
        count: messages.length,
        messages: messages.map((m) => ({
          id: m.id,
          from: messageFromLine(m),
          subject: m.subject ?? "(No subject)",
          snippet: (m.snippet ?? "").slice(0, 120),
          date: formatMessageDate(m.date),
          unread: Boolean(m.unread),
        })),
      },
    };
  } catch {
    return { ok: false, error: "Could not fetch email right now." };
  }
}

export async function mailGetMessage(userId: string, messageId: string): Promise<MailToolResult> {
  const { grant, error } = await requireGrant(userId);
  if (error || !grant) return { ok: false, error: error ?? "Inbox not connected" };

  try {
    const msg = await fetchMessage(grant.nylasGrantId, messageId);
    if (!msg) return { ok: false, error: "Message not found." };
    return {
      ok: true,
      data: {
        ...serializeMessageSummary(msg),
        bodyText: messagePlainText(msg).slice(0, 8000),
        from: messageFromLine(msg),
      },
    };
  } catch {
    return { ok: false, error: "Could not open that message." };
  }
}

export async function mailDraftReply(
  userId: string,
  params: { messageId: string; instructions?: string },
): Promise<MailToolResult> {
  const { grant, error } = await requireGrant(userId);
  if (error || !grant) return { ok: false, error: error ?? "Inbox not connected" };

  const [msg, user, profile] = await Promise.all([
    fetchMessage(grant.nylasGrantId, params.messageId),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { headline: true, summary: true } }),
  ]);
  if (!msg) return { ok: false, error: "Message not found." };

  const prompt = `Draft a concise professional email reply body only (no subject, no signature block).
Candidate: ${user?.name ?? "the candidate"}
${profile?.headline ? `Headline: ${profile.headline}` : ""}
${params.instructions ? `Instructions: ${params.instructions}` : ""}

Replying to:
From: ${messageFromLine(msg)}
Subject: ${msg.subject ?? ""}
Body excerpt: ${messagePlainText(msg).slice(0, 2500)}`;

  try {
    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 512,
      userId,
      tags: ["feature:mail-draft"],
    });
    const reSubject = (msg.subject ?? "").startsWith("Re:") ? msg.subject : `Re: ${msg.subject ?? ""}`;
    const toEmail = msg.from?.[0]?.email ?? "";
    return {
      ok: true,
      data: {
        messageId: params.messageId,
        to: toEmail,
        subject: reSubject,
        body: text.trim(),
        replyToMessageId: params.messageId,
      },
    };
  } catch {
    return { ok: false, error: "Could not draft a reply." };
  }
}

export async function mailSend(
  userId: string,
  params: {
    to: string;
    subject: string;
    body: string;
    replyToMessageId?: string;
  },
): Promise<MailToolResult> {
  const { grant, error } = await requireGrant(userId);
  if (error || !grant) return { ok: false, error: error ?? "Inbox not connected" };

  const to = params.to.trim();
  const subject = params.subject.trim();
  const body = params.body.trim();
  if (!to || !subject || !body) {
    return { ok: false, error: "To, subject, and body are required to send." };
  }

  try {
    const sent = await sendMessage(grant.nylasGrantId, {
      subject,
      body,
      to: [{ email: to }],
      replyToMessageId: params.replyToMessageId?.trim() || undefined,
    });
    if (!sent) return { ok: false, error: "Send failed." };

    logOutboundSend({
      userId,
      sent,
      toEmail: to,
      subject,
      body,
    }).catch((err) => console.error("[mailSend] activity log", err));

    return { ok: true, data: { sent: true, message: serializeMessageSummary(sent) } };
  } catch {
    return { ok: false, error: "Could not send — you may need to reconnect inbox with send permission." };
  }
}

export async function mailListCalendar(userId: string, daysAhead = 14): Promise<MailToolResult> {
  const { grant, error } = await requireGrant(userId);
  if (error || !grant) return { ok: false, error: error ?? "Inbox not connected" };

  try {
    const events = await fetchUpcomingEvents(grant.nylasGrantId, Math.min(daysAhead, 30));
    return {
      ok: true,
      data: {
        events: events.slice(0, 15).map((e) => ({
          id: e.id,
          title: e.title ?? "(No title)",
          start: e.when?.start_time ? new Date(e.when.start_time * 1000).toISOString() : null,
          location: e.location ?? null,
        })),
      },
    };
  } catch {
    return { ok: false, error: "Could not load calendar." };
  }
}

export async function mailUpdateJobStage(
  userId: string,
  jobId: string,
  stage: string,
): Promise<MailToolResult> {
  const valid = Object.values(JobStage) as string[];
  if (!valid.includes(stage)) {
    return { ok: false, error: `Invalid stage. Use one of: ${valid.join(", ")}` };
  }
  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) return { ok: false, error: "Job not found in your pipeline." };
  await prisma.job.update({ where: { id: jobId }, data: { stage: stage as JobStage } });
  return { ok: true, data: { jobId, stage, company: job.company, role: job.role } };
}

export async function executeMailTool(
  userId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<MailToolResult> {
  switch (tool) {
    case "list_recent_emails":
      return mailListRecent(userId, {
        limit: typeof args.limit === "number" ? args.limit : undefined,
        query: typeof args.query === "string" ? args.query : undefined,
      });
    case "get_email":
      return typeof args.messageId === "string"
        ? mailGetMessage(userId, args.messageId)
        : { ok: false, error: "messageId required" };
    case "draft_email_reply":
      return typeof args.messageId === "string"
        ? mailDraftReply(userId, {
            messageId: args.messageId,
            instructions: typeof args.instructions === "string" ? args.instructions : undefined,
          })
        : { ok: false, error: "messageId required" };
    case "send_email":
      return mailSend(userId, {
        to: String(args.to ?? ""),
        subject: String(args.subject ?? ""),
        body: String(args.body ?? ""),
        replyToMessageId: typeof args.replyToMessageId === "string" ? args.replyToMessageId : undefined,
      });
    case "list_calendar_events":
      return mailListCalendar(userId, typeof args.daysAhead === "number" ? args.daysAhead : 14);
    case "update_job_stage":
      return typeof args.jobId === "string" && typeof args.stage === "string"
        ? mailUpdateJobStage(userId, args.jobId, args.stage)
        : { ok: false, error: "jobId and stage required" };
    default:
      return { ok: false, error: `Unknown mail tool: ${tool}` };
  }
}
