import { ctaButton, coachEmailShell, emailShell, escapeHtml, appBaseUrl } from "@/lib/comms/email-shell";
import { sendKimchiEmail } from "@/lib/comms/send-email";
import { prisma } from "@/lib/prisma";
import { formatSessionDateRange } from "@/lib/live-session-display";
import { googleCalendarUrl } from "@/lib/live-calendar";
import { logLiveSessionEvent } from "@/lib/live-session-events";

function liveSessionPath(session: { legacyNumericId: number | null; id: string }) {
  const routeId = session.legacyNumericId != null ? String(session.legacyNumericId) : session.id;
  return `${appBaseUrl()}/live/${routeId}`;
}

type SessionEmailFields = {
  title: string;
  host: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  legacyNumericId: number | null;
  id: string;
};

export async function sendLiveSessionRegistrationEmail(params: {
  email: string;
  name?: string | null;
  session: SessionEmailFields;
}) {
  const firstName = params.name?.split(" ")[0] ?? "there";
  const { date, time } = formatSessionDateRange(params.session.scheduledStart, params.session.scheduledEnd);
  const joinUrl = liveSessionPath(params.session);

  const html = emailShell({
    brand: "Kimchi Live",
    title: `You're in, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your seat is saved for <strong>${escapeHtml(params.session.title)}</strong> with ${escapeHtml(params.session.host)}.
      </p>
      <p style="margin:0;font-size:14px;color:#6B6258;line-height:1.6;">${escapeHtml(date)} · ${escapeHtml(time)}</p>
      <p style="margin:16px 0 0;font-size:14px;color:#52493F;line-height:1.7;">
        We'll email you before it starts. When we're live, use the same link to join in one click.
      </p>
      ${ctaButton(joinUrl, "View session →")}
      ${ctaButton(googleCalendarUrl(params.session), "Add to Google Calendar →")}`,
  });

  await sendKimchiEmail({
    to: params.email,
    subject: `You're registered — ${params.session.title}`,
    html,
    template: "live_register",
    bypassAutomatedGate: true,
  });
}

export async function sendLiveSessionReminderEmail(params: {
  email: string;
  name?: string | null;
  session: SessionEmailFields;
  window: "24h" | "1h" | "15m";
}) {
  const firstName = params.name?.split(" ")[0] ?? "there";
  const { date, time } = formatSessionDateRange(params.session.scheduledStart, params.session.scheduledEnd);
  const joinUrl = liveSessionPath(params.session);

  const when =
    params.window === "24h"
      ? "tomorrow"
      : params.window === "1h"
        ? "in about 1 hour"
        : "in about 15 minutes";

  const html = emailShell({
    brand: "Kimchi Live",
    title: `Almost time, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(params.session.title)}</strong> with ${escapeHtml(params.session.host)} starts ${when}.
      </p>
      <p style="margin:0;font-size:14px;color:#6B6258;">${escapeHtml(date)} · ${escapeHtml(time)}</p>
      ${ctaButton(joinUrl, "Join when we're live →")}`,
  });

  await sendKimchiEmail({
    to: params.email,
    subject: `Starting ${when} — ${params.session.title}`,
    html,
    template: "live_reminder",
    bypassAutomatedGate: true,
  });
}

export async function sendLiveSessionLiveNowEmail(params: {
  email: string;
  name?: string | null;
  session: Pick<SessionEmailFields, "title" | "host" | "legacyNumericId" | "id">;
}) {
  const firstName = params.name?.split(" ")[0] ?? "there";
  const joinUrl = liveSessionPath(params.session);

  const html = emailShell({
    brand: "Kimchi Live",
    title: `We're live, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        ${escapeHtml(params.session.host)} just started <strong>${escapeHtml(params.session.title)}</strong>.
      </p>
      ${ctaButton(joinUrl, "Join now →")}`,
  });

  await sendKimchiEmail({
    to: params.email,
    subject: `● Live now — ${params.session.title}`,
    html,
    template: "live_reminder",
    bypassAutomatedGate: true,
  });
}

export async function sendLiveSessionCancelledEmail(params: {
  email: string;
  name?: string | null;
  session: Pick<SessionEmailFields, "title" | "host">;
}) {
  const firstName = params.name?.split(" ")[0] ?? "there";
  const html = emailShell({
    brand: "Kimchi Live",
    title: `Session cancelled, ${firstName}.`,
    bodyHtml: `<p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(params.session.title)}</strong> with ${escapeHtml(params.session.host)} was cancelled.
        We'll let you know when it's rescheduled.
      </p>
      ${ctaButton(`${appBaseUrl()}/live`, "Browse upcoming sessions →")}`,
  });

  await sendKimchiEmail({
    to: params.email,
    subject: `Cancelled — ${params.session.title}`,
    html,
    template: "live_cancel",
    bypassAutomatedGate: true,
  });
}

/** Coach follower email when session goes live. */
export async function notifyCoachFollowersLive(sessionId: string): Promise<number> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      coachProfile: {
        include: {
          follows: { include: { user: { select: { email: true, name: true } } } },
        },
      },
    },
  });

  if (!session?.coachProfile || session.followNotifySentAt) return 0;

  let sent = 0;
  const coachName = session.coachProfile.displayName;
  const joinUrl = liveSessionPath(session);

  for (const follow of session.coachProfile.follows) {
    if (!follow.user.email) continue;
    try {
      const html = coachEmailShell(
        coachName,
        `${coachName} just went live.`,
        `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
            <strong>${escapeHtml(session.title)}</strong> is happening now.
          </p>
          ${ctaButton(joinUrl, "Join now →")}`,
      );
      await sendKimchiEmail({
        to: follow.user.email,
        subject: `${coachName} is live — ${session.title}`,
        html,
        template: "live_follower_live",
      });
      sent += 1;
    } catch (err) {
      console.error("[live/follower email]", follow.userId, err);
    }
  }

  if (sent > 0) {
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { followNotifySentAt: new Date() },
    });
    await logLiveSessionEvent({
      liveSessionId: sessionId,
      type: "FOLLOWER_NOTIFIED",
      metadata: { count: sent },
    });
  }

  return sent;
}

/** Post-webinar recap for coach followers — replay + book coach. */
export async function notifyCoachFollowersPostSession(sessionId: string): Promise<number> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      coachProfile: {
        include: {
          follows: { include: { user: { select: { email: true, name: true } } } },
        },
      },
    },
  });

  if (!session?.coachProfile || session.followerPostSessionSentAt) return 0;

  const coachName = session.coachProfile.displayName;
  const routeId = session.legacyNumericId != null ? String(session.legacyNumericId) : session.id;
  const replayUrl = session.recordingUrl ?? session.hlsPlaybackUrl ?? `${appBaseUrl()}/live/${routeId}/replay`;
  const bookHref = session.coachProfile.slug
    ? `${appBaseUrl()}/coach/${session.coachProfile.slug}`
    : `${appBaseUrl()}/coaching`;

  let sent = 0;
  for (const follow of session.coachProfile.follows) {
    if (!follow.user.email) continue;
    const firstName = follow.user.name?.split(" ")[0] ?? "there";
    try {
      const html = coachEmailShell(
        coachName,
        `Thanks for following, ${firstName}.`,
        `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
            We wrapped <strong>${escapeHtml(session.title)}</strong> with ${escapeHtml(coachName)}.
          </p>
          ${ctaButton(replayUrl, "Watch replay →")}
          ${ctaButton(bookHref, "Book time with the coach →")}`,
      );
      await sendKimchiEmail({
        to: follow.user.email,
        subject: `Replay — ${session.title} with ${coachName}`,
        html,
        template: "live_follower_post",
      });
      sent += 1;
    } catch (err) {
      console.error("[live/follower post]", follow.userId, err);
    }
  }

  if (sent > 0) {
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { followerPostSessionSentAt: new Date() },
    });
    await logLiveSessionEvent({
      liveSessionId: sessionId,
      type: "POST_SESSION_SENT",
      metadata: { count: sent, audience: "followers" },
    });
  }

  return sent;
}
