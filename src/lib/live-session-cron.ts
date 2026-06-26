import { prisma } from "@/lib/prisma";
import { endLiveSession } from "@/lib/live-session-actions";
import {
  notifyCoachFollowersPostSession,
  sendLiveSessionLiveNowEmail,
  sendLiveSessionReminderEmail,
} from "@/lib/comms/live-session-emails";
import { logLiveSessionEvent } from "@/lib/live-session-events";
import { snapshotLiveRoomMetrics } from "@/lib/hms";

const REMINDER_15M_MS = 15 * 60 * 1000;
const REMINDER_1H_MS = 60 * 60 * 1000;
const REMINDER_24H_MS = 24 * 60 * 60 * 1000;
const REMINDER_TOLERANCE_MS = 10 * 60 * 1000;

export type LiveSessionCronSummary = {
  autoEnded: number;
  remindersSent: number;
  followerPostSent: number;
  metricsUpdated: number;
  errors: string[];
};

type ReminderWindow = "24h" | "1h" | "15m";

function reminderConfig(window: ReminderWindow) {
  switch (window) {
    case "24h":
      return { offsetMs: REMINDER_24H_MS, flag: "reminder24hSentAt" as const };
    case "1h":
      return { offsetMs: REMINDER_1H_MS, flag: "reminder1hSentAt" as const };
    case "15m":
      return { offsetMs: REMINDER_15M_MS, flag: "reminderSentAt" as const };
  }
}

async function sendReminderWindow(window: ReminderWindow, now: Date, summary: LiveSessionCronSummary) {
  const { offsetMs, flag } = reminderConfig(window);
  const reminderStart = new Date(now.getTime() + offsetMs - REMINDER_TOLERANCE_MS);
  const reminderEnd = new Date(now.getTime() + offsetMs + REMINDER_TOLERANCE_MS);

  const upcoming = await prisma.liveSession.findMany({
    where: {
      status: "SCHEDULED",
      scheduledStart: { gte: reminderStart, lte: reminderEnd },
    },
    include: {
      registrations: {
        where: { [flag]: null },
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
          window,
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
          data: { [flag]: now },
        });
        await logLiveSessionEvent({
          liveSessionId: session.id,
          userId: reg.userId,
          type: "REMINDER_SENT",
          metadata: { window },
        });
        summary.remindersSent += 1;
      } catch (err) {
        summary.errors.push(`reminder ${window} ${reg.id}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }
}

export async function runLiveSessionCron(): Promise<LiveSessionCronSummary> {
  const summary: LiveSessionCronSummary = {
    autoEnded: 0,
    remindersSent: 0,
    followerPostSent: 0,
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
        await notifyCoachFollowersPostSession(session.id);
        summary.followerPostSent += 1;
      } catch (err) {
        summary.errors.push(`auto-end ${session.id}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  const expiredLive = await prisma.liveSession.findMany({
    where: {
      status: "ENDED",
      followerPostSessionSentAt: null,
      endedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });

  for (const session of expiredLive) {
    try {
      await notifyCoachFollowersPostSession(session.id);
      summary.followerPostSent += 1;
    } catch (err) {
      summary.errors.push(`follower-post ${session.id}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  for (const window of ["24h", "1h", "15m"] as ReminderWindow[]) {
    await sendReminderWindow(window, now, summary);
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
