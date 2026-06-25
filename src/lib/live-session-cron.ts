import { prisma } from "@/lib/prisma";
import { endLiveSession } from "@/lib/live-session-actions";
import {
  sendLiveSessionLiveNowEmail,
  sendLiveSessionReminderEmail,
} from "@/lib/live-session-emails";

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const REMINDER_TOLERANCE_MS = 5 * 60 * 1000;

export type LiveSessionCronSummary = {
  autoEnded: number;
  remindersSent: number;
  errors: string[];
};

export async function runLiveSessionCron(): Promise<LiveSessionCronSummary> {
  const summary: LiveSessionCronSummary = { autoEnded: 0, remindersSent: 0, errors: [] };
  const now = new Date();

  const expiredLive = await prisma.liveSession.findMany({
    where: {
      status: "LIVE",
      scheduledEnd: { lt: now },
    },
  });

  for (const session of expiredLive) {
    try {
      await endLiveSession(session, true);
      summary.autoEnded += 1;
    } catch (err) {
      summary.errors.push(`auto-end ${session.id}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  const reminderStart = new Date(now.getTime() + REMINDER_WINDOW_MS - REMINDER_TOLERANCE_MS);
  const reminderEnd = new Date(now.getTime() + REMINDER_WINDOW_MS + REMINDER_TOLERANCE_MS);

  const upcoming = await prisma.liveSession.findMany({
    where: {
      status: "SCHEDULED",
      scheduledStart: { gte: reminderStart, lte: reminderEnd },
    },
    include: {
      registrations: {
        where: { reminderSentAt: null },
        include: { user: { select: { email: true, name: true } } },
      },
    },
  });

  for (const session of upcoming) {
    for (const reg of session.registrations) {
      if (!reg.user.email) continue;
      try {
        await sendLiveSessionReminderEmail({
          email: reg.user.email,
          name: reg.user.name,
          session: {
            title: session.title,
            host: session.hostName,
            scheduledStart: session.scheduledStart,
            scheduledEnd: session.scheduledEnd,
            legacyNumericId: session.legacyNumericId,
            id: session.id,
          },
        });
        await prisma.liveSessionRegistration.update({
          where: { id: reg.id },
          data: { reminderSentAt: now },
        });
        summary.remindersSent += 1;
      } catch (err) {
        summary.errors.push(`reminder ${reg.id}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  return summary;
}

/** Notify registered attendees when a session goes live (first time only). */
export async function notifyLiveSessionLiveNow(sessionId: string): Promise<number> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      registrations: {
        include: { user: { select: { email: true, name: true } } },
      },
    },
  });

  if (!session || session.liveNowEmailSentAt) return 0;

  let sent = 0;
  for (const reg of session.registrations) {
    if (!reg.user.email) continue;
    try {
      await sendLiveSessionLiveNowEmail({
        email: reg.user.email,
        name: reg.user.name,
        session: {
          title: session.title,
          host: session.hostName,
          legacyNumericId: session.legacyNumericId,
          id: session.id,
        },
      });
      sent += 1;
    } catch (err) {
      console.error("[live/notify-live-now]", reg.id, err);
    }
  }

  await prisma.liveSession.update({
    where: { id: sessionId },
    data: { liveNowEmailSentAt: new Date() },
  });

  return sent;
}
