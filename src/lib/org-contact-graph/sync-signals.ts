import { InboxActivityDirection } from "@prisma/client";
import type { OrgNetworkSource } from "@prisma/client";
import { messageDirection } from "@/lib/inbox-crm/direction";
import { listMessages, type NylasEvent, type NylasMessage, type NylasParticipant } from "@/lib/nylas-inbox";
import { nylasFetch } from "@/lib/nylas";
import { normalizeOrgContactEmail } from "@/lib/org-contact-graph/normalize-email";
import { touchOrgContactKnownBy, upsertOrgContact } from "@/lib/org-contact-graph/upsert";

const BACKFILL_MONTHS = 12;
const MAX_MESSAGES = 500;
const MESSAGE_PAGE_SIZE = 50;

type SyncableOrgNetworkSource = OrgNetworkSource & {
  orgMember: { orgId: string };
};

function snippetFor(message: NylasMessage): string {
  return (message.snippet ?? "").trim().slice(0, 240);
}

function pickCounterparty(
  message: NylasMessage,
  userEmail: string | null | undefined,
  direction: InboxActivityDirection,
): NylasParticipant | null {
  const user = normalizeOrgContactEmail(userEmail);
  const list =
    direction === InboxActivityDirection.OUTBOUND
      ? [...(message.to ?? []), ...(message.cc ?? [])]
      : message.from ?? [];

  for (const participant of list) {
    const email = normalizeOrgContactEmail(participant.email);
    if (!email || (user && email === user)) continue;
    return participant;
  }
  return list[0] ?? null;
}

async function fetchEventsInRange(
  grantId: string,
  start: Date,
  end: Date,
  limit = 100,
): Promise<NylasEvent[]> {
  const params = new URLSearchParams({
    start: String(Math.floor(start.getTime() / 1000)),
    end: String(Math.floor(end.getTime() / 1000)),
    limit: String(limit),
  });
  const res = await nylasFetch<{ data?: NylasEvent[] }>(
    `/v3/grants/${grantId}/events?${params.toString()}`,
    { grantId },
  );
  return res.data ?? [];
}

async function recordMessageSignal(params: {
  source: SyncableOrgNetworkSource;
  message: NylasMessage;
  userEmail: string | null | undefined;
}) {
  const direction = messageDirection(params.message, params.userEmail);
  const counterparty = pickCounterparty(params.message, params.userEmail, direction);
  const email = normalizeOrgContactEmail(counterparty?.email);
  if (!email) return false;

  const occurredAt = params.message.date ? new Date(params.message.date * 1000) : new Date();
  const contact = await upsertOrgContact({
    orgId: params.source.orgMember.orgId,
    email,
    name: counterparty?.name ?? null,
    activityAt: occurredAt,
  });
  if (!contact) return false;

  await touchOrgContactKnownBy({
    orgContactId: contact.id,
    networkSourceId: params.source.id,
    seenAt: occurredAt,
    patch: {
      emailCount: 1,
      inboundCount: direction === InboxActivityDirection.INBOUND ? 1 : 0,
      outboundCount: direction === InboxActivityDirection.OUTBOUND ? 1 : 0,
      subject: params.message.subject ?? (snippetFor(params.message) || null),
      lastEmailAt: occurredAt.toISOString(),
    },
  });
  return true;
}

async function recordEventSignals(params: {
  source: SyncableOrgNetworkSource;
  event: NylasEvent;
  userEmail: string | null | undefined;
}) {
  const user = normalizeOrgContactEmail(params.userEmail);
  const occurredAt = params.event.when?.start_time
    ? new Date(params.event.when.start_time * 1000)
    : new Date();
  const title = params.event.title?.trim() || "Calendar event";
  const participantCount = (params.event.participants ?? []).filter((p) =>
    Boolean(normalizeOrgContactEmail(p.email)),
  ).length;
  const isOneOnOne = participantCount > 0 && participantCount <= 2;
  let recorded = 0;

  for (const participant of params.event.participants ?? []) {
    const email = normalizeOrgContactEmail(participant.email);
    if (!email || (user && email === user)) continue;

    const contact = await upsertOrgContact({
      orgId: params.source.orgMember.orgId,
      email,
      name: participant.name ?? null,
      activityAt: occurredAt,
    });
    if (!contact) continue;

    await touchOrgContactKnownBy({
      orgContactId: contact.id,
      networkSourceId: params.source.id,
      seenAt: occurredAt,
      patch: {
        meetingCount: 1,
        oneOnOneMeetingCount: isOneOnOne ? 1 : 0,
        groupMeetingCount: isOneOnOne ? 0 : 1,
        meetingTitle: title,
        lastMeetingAt: occurredAt.toISOString(),
      },
    });
    recorded += 1;
  }

  return recorded;
}

export async function syncOrgNetworkSourceSignals(source: SyncableOrgNetworkSource) {
  if (!source.nylasGrantId) return { messages: 0, events: 0, skipped: true as const };

  const userEmail = source.email;
  const since = new Date(Date.now() - BACKFILL_MONTHS * 30 * 24 * 60 * 60 * 1000);
  let messagesProcessed = 0;
  let pageToken: string | undefined;

  while (messagesProcessed < MAX_MESSAGES) {
    const { messages, nextCursor } = await listMessages(source.nylasGrantId, {
      receivedAfter: since,
      limit: MESSAGE_PAGE_SIZE,
      pageToken,
    });

    for (const message of messages) {
      if (messagesProcessed >= MAX_MESSAGES) break;
      try {
        const ok = await recordMessageSignal({ source, message, userEmail });
        if (ok) messagesProcessed += 1;
      } catch (err) {
        console.error("[org-contact-graph] message", source.id, message.id, err);
      }
    }

    if (!nextCursor || messages.length === 0) break;
    pageToken = nextCursor;
  }

  const eventStart = since;
  const eventEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  let eventsProcessed = 0;
  const events = await fetchEventsInRange(source.nylasGrantId, eventStart, eventEnd, 100);
  for (const event of events) {
    try {
      eventsProcessed += await recordEventSignals({ source, event, userEmail });
    } catch (err) {
      console.error("[org-contact-graph] event", source.id, event.id, err);
    }
  }

  return { messages: messagesProcessed, events: eventsProcessed, skipped: false as const };
}
