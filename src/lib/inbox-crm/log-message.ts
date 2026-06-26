import {
  InboxActivityDirection,
  InboxActivityKind,
  type InboxActivity,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchMessage,
  messageFromLine,
  messagePlainText,
  type NylasMessage,
} from "@/lib/nylas-inbox";
import { categorizeInboxMail } from "@/lib/inbox-crm/categorize";
import { messageDirection } from "@/lib/inbox-crm/direction";
import { upsertContactFromMessage } from "@/lib/inbox-crm/contacts";

function snippetFor(message: NylasMessage): string {
  const text = (message.snippet ?? messagePlainText(message)).trim();
  return text.slice(0, 240);
}

export async function logInboxMessage(params: {
  userId: string;
  grantId: string;
  userEmail: string | null | undefined;
  message: NylasMessage;
  forceRefresh?: boolean;
}): Promise<InboxActivity | null> {
  const messageId = params.message.id;
  if (!messageId) return null;

  if (!params.forceRefresh) {
    const existing = await prisma.inboxActivity.findUnique({
      where: { userId_nylasMessageId: { userId: params.userId, nylasMessageId: messageId } },
    });
    if (existing) return existing;
  }

  const full = params.message.body ? params.message : (await fetchMessage(params.grantId, messageId)) ?? params.message;
  const direction = messageDirection(full, params.userEmail);
  const from = full.from?.[0];
  const category = categorizeInboxMail({
    fromEmail: from?.email,
    fromName: from?.name,
    subject: full.subject,
    snippet: full.snippet,
  });

  const contact = await upsertContactFromMessage(params.userId, full, params.userEmail);
  const occurredAt = full.date ? new Date(full.date * 1000) : new Date();

  const data = {
    userId: params.userId,
    kind: InboxActivityKind.EMAIL,
    direction,
    category,
    contactId: contact?.id ?? null,
    nylasMessageId: messageId,
    nylasThreadId: full.thread_id ?? null,
    subject: full.subject ?? messageFromLine(full),
    snippet: snippetFor(full),
    occurredAt,
    rawPayload: full as object,
  };

  return prisma.inboxActivity.upsert({
    where: { userId_nylasMessageId: { userId: params.userId, nylasMessageId: messageId } },
    create: data,
    update: {
      direction: data.direction,
      category: data.category,
      contactId: data.contactId,
      nylasThreadId: data.nylasThreadId,
      subject: data.subject,
      snippet: data.snippet,
      occurredAt: data.occurredAt,
      rawPayload: data.rawPayload,
    },
  });
}
