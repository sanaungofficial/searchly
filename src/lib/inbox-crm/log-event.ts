import { InboxActivityDirection, InboxActivityKind, type InboxActivity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchEvent, type NylasEvent } from "@/lib/nylas-inbox";
import { categorizeCalendarEvent } from "@/lib/inbox-crm/categorize";
import { upsertContactFromEvent } from "@/lib/inbox-crm/contacts";

export async function logInboxEvent(params: {
  userId: string;
  grantId: string;
  userEmail: string | null | undefined;
  event: NylasEvent;
}): Promise<InboxActivity | null> {
  const eventId = params.event.id;
  if (!eventId) return null;

  const existing = await prisma.inboxActivity.findUnique({
    where: { userId_nylasEventId: { userId: params.userId, nylasEventId: eventId } },
  });
  if (existing) return existing;

  const full = params.event.title ? params.event : (await fetchEvent(params.grantId, eventId)) ?? params.event;
  const participantEmails =
    full.participants?.map((p) => p.email?.trim().toLowerCase()).filter(Boolean) as string[] | undefined;

  const category = categorizeCalendarEvent({
    title: full.title,
    description: full.description,
    participantEmails,
  });

  const contact = await upsertContactFromEvent(params.userId, full, params.userEmail);
  const occurredAt = full.when?.start_time ? new Date(full.when.start_time * 1000) : new Date();
  const snippet = [full.title, full.location].filter(Boolean).join(" · ").slice(0, 240);

  const data = {
    userId: params.userId,
    kind: InboxActivityKind.MEETING,
    direction: InboxActivityDirection.INBOUND,
    category,
    contactId: contact?.id ?? null,
    nylasEventId: eventId,
    subject: full.title ?? "Calendar event",
    snippet: snippet || null,
    occurredAt,
    rawPayload: full as object,
  };

  return prisma.inboxActivity.upsert({
    where: { userId_nylasEventId: { userId: params.userId, nylasEventId: eventId } },
    create: data,
    update: {
      category: data.category,
      contactId: data.contactId,
      subject: data.subject,
      snippet: data.snippet,
      occurredAt: data.occurredAt,
      rawPayload: data.rawPayload,
    },
  });
}
