import { prisma } from "@/lib/prisma";
import {
  fetchEvent,
  fetchMessage,
  fetchRecentMessages,
  fetchUpcomingEvents,
} from "@/lib/nylas-inbox";
import { logInboxEvent } from "@/lib/inbox-crm/log-event";
import { logInboxMessage } from "@/lib/inbox-crm/log-message";

export { logInboxMessage } from "@/lib/inbox-crm/log-message";
export { logInboxEvent } from "@/lib/inbox-crm/log-event";
export { logOutboundSend } from "@/lib/inbox-crm/log-send";
export { categorizeInboxMail, categorizeCalendarEvent } from "@/lib/inbox-crm/categorize";

async function resolveUserEmail(userId: string, grantEmail: string | null | undefined) {
  if (grantEmail) return grantEmail;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

export async function processInboxMessageWebhook(grantId: string, messageId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { nylasGrantId: grantId } });
  if (!grant) return null;

  const message = await fetchMessage(grantId, messageId);
  if (!message) return null;

  const userEmail = await resolveUserEmail(grant.userId, grant.email);
  return logInboxMessage({
    userId: grant.userId,
    grantId,
    userEmail,
    message,
  });
}

export async function processInboxEventWebhook(grantId: string, eventId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { nylasGrantId: grantId } });
  if (!grant) return null;

  const event = await fetchEvent(grantId, eventId);
  if (!event) return null;

  const userEmail = await resolveUserEmail(grant.userId, grant.email);
  return logInboxEvent({
    userId: grant.userId,
    grantId,
    userEmail,
    event,
  });
}

/** Rule-based backfill — logs all recent mail and calendar events (no AI). */
export async function syncInboxActivities(userId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { userId } });
  if (!grant) return { processed: 0 };

  const userEmail = await resolveUserEmail(userId, grant.email);
  const since = grant.lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let processed = 0;

  const messages = await fetchRecentMessages(grant.nylasGrantId, since, 50);
  for (const msg of messages) {
    try {
      const row = await logInboxMessage({
        userId,
        grantId: grant.nylasGrantId,
        userEmail,
        message: msg,
      });
      if (row) processed += 1;
    } catch (err) {
      console.error("[inbox-crm] message", userId, msg.id, err);
    }
  }

  const events = await fetchUpcomingEvents(grant.nylasGrantId, 21);
  for (const ev of events) {
    try {
      const row = await logInboxEvent({
        userId,
        grantId: grant.nylasGrantId,
        userEmail,
        event: ev,
      });
      if (row) processed += 1;
    } catch (err) {
      console.error("[inbox-crm] event", userId, ev.id, err);
    }
  }

  return { processed };
}
