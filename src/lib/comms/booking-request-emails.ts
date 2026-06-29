import { CoachBookingCommAudience, CoachBookingCommType } from "@prisma/client";
import { coachEmailShell, ctaButton, emailShell, escapeHtml, appBaseUrl } from "@/lib/comms/email-shell";
import { sendKimchiEmail } from "@/lib/comms/send-email";
import { logBookingCommunication } from "@/lib/booking-communications";
import type { BookingRequestPreferredTime } from "@/lib/coach-booking-request";

function formatPreferredTimes(times: BookingRequestPreferredTime[], timezone?: string | null): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return times
    .map((slot) => {
      const start = new Date(slot.startTime * 1000);
      const end = new Date(slot.endTime * 1000);
      const dayFmt = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: tz,
      });
      const timeFmt = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });
      return `${dayFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
    })
    .join("<br />");
}

export async function sendBookingRequestGuestAckEmail(params: {
  coachProfileId: string;
  bookingId: string;
  clientUserId: string;
  guestEmail: string;
  guestName: string;
  coachName: string;
  preferredTimes: BookingRequestPreferredTime[];
  sessionType: "intro" | "session";
  timezone?: string | null;
}) {
  const name = params.guestName.trim() || "there";
  const sessionLabel = params.sessionType === "intro" ? "intro call" : "coaching session";
  const subject = `Request sent to ${params.coachName}`;
  const timesHtml = formatPreferredTimes(params.preferredTimes, params.timezone);

  const html = coachEmailShell(
    params.coachName,
    `We got your request, ${escapeHtml(name.split(" ")[0] ?? name)}.`,
    `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your ${sessionLabel} request with <strong>${escapeHtml(params.coachName)}</strong> is on its way.
        They'll confirm a time or suggest alternatives.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6B6258;font-weight:600;">Preferred times</p>
      <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">${timesHtml}</p>
      <p style="margin:24px 0 0;font-size:14px;color:#6B6258;">You'll hear back by email once ${escapeHtml(params.coachName.split(" ")[0] ?? "your coach")} responds.</p>`,
  );

  await sendKimchiEmail({
    to: params.guestEmail,
    subject,
    html,
    template: "booking_confirm",
    bypassAutomatedGate: true,
  });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: CoachBookingCommType.GUEST_CONFIRMATION,
    audience: CoachBookingCommAudience.GUEST,
    recipientEmail: params.guestEmail,
    subject,
    bodyPreview: `Booking request sent to ${params.coachName}.`,
  }).catch((err) => console.error("[booking-request-emails] log guest ack", err));
}

export async function sendBookingRequestCoachNotificationEmail(params: {
  coachProfileId: string;
  bookingId: string;
  clientUserId: string;
  coachEmail: string;
  coachName: string;
  guestName: string;
  guestEmail: string;
  preferredTimes: BookingRequestPreferredTime[];
  sessionType: "intro" | "session";
  message?: string | null;
  timezone?: string | null;
}) {
  const guest = params.guestName.trim() || params.guestEmail;
  const sessionLabel = params.sessionType === "intro" ? "Intro call request" : "Session request";
  const subject = `${sessionLabel}: ${guest}`;
  const timesHtml = formatPreferredTimes(params.preferredTimes, params.timezone);
  const base = appBaseUrl();
  const messageBlock = params.message?.trim()
    ? `<p style="margin:16px 0 0;font-size:14px;color:#52493F;line-height:1.7;"><strong>Message:</strong><br />${escapeHtml(params.message.trim())}</p>`
    : "";

  const html = emailShell({
    title: sessionLabel,
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(guest)}</strong> (${escapeHtml(params.guestEmail)}) requested a session with you on Kimchi.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6B6258;font-weight:600;">Preferred times</p>
      <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">${timesHtml}</p>
      ${messageBlock}
      ${ctaButton(`${base}/expert/clients`, "View in Kimchi →")}`,
  });

  await sendKimchiEmail({
    to: params.coachEmail,
    subject,
    html,
    template: "booking_confirm",
    bypassAutomatedGate: true,
  });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: CoachBookingCommType.COACH_NOTIFICATION,
    audience: CoachBookingCommAudience.COACH,
    recipientEmail: params.coachEmail,
    subject,
    bodyPreview: `${guest} requested a session.`,
  }).catch((err) => console.error("[booking-request-emails] log coach notification", err));
}
