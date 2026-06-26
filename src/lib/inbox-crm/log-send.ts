import {
  InboxActivityCategory,
  InboxActivityDirection,
  InboxActivityKind,
  type InboxActivity,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { categorizeInboxMail } from "@/lib/inbox-crm/categorize";
import { upsertContactFromParticipant } from "@/lib/inbox-crm/contacts";
import type { NylasMessage } from "@/lib/nylas-inbox";

function snippetFor(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function logOutboundSend(params: {
  userId: string;
  sent: NylasMessage;
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
}): Promise<InboxActivity | null> {
  const messageId = params.sent.id;
  if (!messageId) return null;

  const contact = await upsertContactFromParticipant(params.userId, {
    email: params.toEmail,
    name: params.toName ?? undefined,
  });

  const category = categorizeInboxMail({
    fromEmail: params.sent.from?.[0]?.email,
    fromName: params.sent.from?.[0]?.name,
    subject: params.subject,
    snippet: snippetFor(params.body),
  });

  const occurredAt = params.sent.date ? new Date(params.sent.date * 1000) : new Date();

  const data = {
    userId: params.userId,
    kind: InboxActivityKind.EMAIL,
    direction: InboxActivityDirection.OUTBOUND,
    category: category === InboxActivityCategory.UNKNOWN ? InboxActivityCategory.PERSONAL : category,
    contactId: contact?.id ?? null,
    nylasMessageId: messageId,
    nylasThreadId: params.sent.thread_id ?? null,
    subject: params.subject,
    snippet: snippetFor(params.body),
    occurredAt,
    rawPayload: params.sent as object,
  };

  return prisma.inboxActivity.upsert({
    where: { userId_nylasMessageId: { userId: params.userId, nylasMessageId: messageId } },
    create: data,
    update: data,
  });
}
