import { prisma } from "@/lib/prisma";
import { endLiveSession } from "@/lib/live-session-actions";
import {
  sendLiveSessionLiveNowEmail,
  sendLiveSessionPostSessionEmail,
  sendLiveSessionReminderEmail,
} from "@/lib/live-session-emails";
import { logLiveSessionEvent } from "@/lib/live-session-events";
import { snapshotLiveRoomMetrics } from "@/lib/hms";

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const REMINDER_TOLERANCE_MS = 5 * 60 * 1000;

export type LiveSessionCronSummary = {
  autoEnded: number;
  remindersSent: number;
  postSessionSent: number;
  metricsUpdated: number;
  errors: string[];
};

export async function runLiveSessionCron(): Promise<LiveSessionCronSummary> {
  const summary: LiveSessionCronSummary = {
    autoEnded: 0,
    remindersSent: 0,
    postSessionSent: 0,
    metricsUpdated: 0,
    errors: [],
  };
  const now = new Date();

  const liveSessions = await prisma.liveSession.findMany({
    where: { status: "LIVE" },
  });

  for (const session of liveSessions) {
    try {
      await snapshotLiveRoomMetrics(session);
      summary.metricsUpdated += 1;
    } catch (err) {
      summary.errors.push(`metrics ${session.id}: ${err instanceof Error ? err.message : "failed"}`);
    }

    if (session.scheduledEnd < now) {
      try {
        await endLiveSession(session, true);
        summary.autoEnded += 1;
        await sendPostSessionEmails(session.id);
        summary.postSessionSent += 1;
      } catch (err) {
        summary.errors.push(`auto-end ${session.id}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  const expiredLive = await prisma.liveSession.findMany({
    where: {
      status: "ENDED",
      postSessionEmailSentAt: null,
      endedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });

  for (const session of expiredLive) {
    try {
      await sendPostSessionEmails(session.id);
      summary.postSessionSent += 1;
    } catch (err) {
      summary.errors.push(`post-session ${session.id}: ${err instanceof Error ? err.message : "failed"}`);
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
        await logLiveSessionEvent({
          liveSessionId: session.id,
          userId: reg.userId,
          type: "REMINDER_SENT",
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

async function sendPostSessionEmails(sessionId: string): Promise<void> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      registrations: {
        where: { joinedAt: { not: null } },
        include: {
          user: { select: { email: true, name: true } },
        },
      },
      coachProfile: { select: { slug: true } },
    },
  });

  if (!session || session.postSessionEmailSentAt) return;

  const replayUrl = session.recordingUrl ?? session.hlsPlaybackUrl ?? null;

  for (const reg of session.registrations) {
    if (!reg.user.email) continue;
    try {
      await sendLiveSessionPostSessionEmail({
        email: reg.user.email,
        name: reg.user.name,
        session: {
          title: session.title,
          host: session.hostName,
          legacyNumericId: session.legacyNumericId,
          id: session.id,
          coachProfileId: session.coachProfileId,
          coachSlug: session.coachProfile?.slug ?? null,
        },
        replayUrl,
      });
      await logLiveSessionEvent({
        liveSessionId: sessionId,
        userId: reg.userId,
        type: "POST_SESSION_SENT",
      });
    } catch (err) {
      console.error("[live/post-session]", reg.id, err);
    }
  }

  await prisma.liveSession.update({
    where: { id: sessionId },
    data: { postSessionEmailSentAt: new Date() },
  });
}
