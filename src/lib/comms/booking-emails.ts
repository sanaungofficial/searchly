import { ctaButton, coachEmailShell, emailShell, escapeHtml, appBaseUrl } from "@/lib/comms/email-shell";
import { sendKimchiEmail } from "@/lib/comms/send-email";
import { formatBookingWhen } from "@/lib/booking-display";
import { logBookingCommunication } from "@/lib/booking-communications";
import { CoachBookingCommAudience, CoachBookingCommType } from "@prisma/client";

export async function sendBookingGuestConfirmationEmail(params: {
  coachProfileId: string;
  bookingId?: string | null;
  clientUserId?: string | null;
  guestEmail: string;
  guestName?: string | null;
  coachName: string;
  title?: string | null;
  startAt: string;
  endAt: string;
  bookingRef?: string | null;
}) {
  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const name = params.guestName?.trim() || "there";
  const ref = params.bookingRef;
  const base = appBaseUrl();
  const subject = `Confirmed: ${params.title ?? `Session with ${params.coachName}`}`;

  const actions = ref
    ? `<p style="margin:24px 0 0;font-size:14px;color:#52493F;line-height:1.7;">
        <a href="${base}/coaching/reschedule/${encodeURIComponent(ref)}" style="color:#1C3A2F;font-weight:600;">Reschedule</a>
        ·
        <a href="${base}/coaching/cancel/${encodeURIComponent(ref)}" style="color:#1C3A2F;font-weight:600;">Cancel</a>
      </p>`
    : "";

  const html = coachEmailShell(
    params.coachName,
    `You're booked, ${escapeHtml(name.split(" ")[0] ?? name)}.`,
    `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your coaching session with <strong>${escapeHtml(params.coachName)}</strong> is confirmed.
      </p>
      <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(date)}</strong><br />${escapeHtml(time)}
      </p>
      ${actions}
      <p style="margin:24px 0 0;font-size:14px;color:#6B6258;">A calendar invite should arrive separately from your coach's calendar.</p>`,
  );

  await sendKimchiEmail({ to: params.guestEmail, subject, html, template: "booking_confirm", bypassAutomatedGate: true });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: CoachBookingCommType.GUEST_CONFIRMATION,
    audience: CoachBookingCommAudience.GUEST,
    recipientEmail: params.guestEmail,
    subject,
    bodyPreview: `Session confirmed with ${params.coachName} on ${date}.`,
  }).catch((err) => console.error("[booking-emails] log guest confirmation", err));
}

export async function sendBookingCoachNotificationEmail(params: {
  coachProfileId: string;
  bookingId?: string | null;
  clientUserId?: string | null;
  coachEmail: string;
  coachName: string;
  guestName?: string | null;
  guestEmail?: string | null;
  title?: string | null;
  startAt: string;
  endAt: string;
}) {
  if (!params.coachEmail) return;

  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const guest = params.guestName?.trim() || params.guestEmail || "A seeker";
  const base = appBaseUrl();
  const subject = `New booking: ${guest}`;

  const html = emailShell({
    title: "New coaching session booked",
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(guest)}</strong>${params.guestEmail ? ` (${escapeHtml(params.guestEmail)})` : ""} booked a session with you.
      </p>
      <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(date)}</strong><br />${escapeHtml(time)}
      </p>
      ${ctaButton(`${base}/expert/ops?section=clients`, "View in Kimchi →")}`,
  });

  await sendKimchiEmail({ to: params.coachEmail, subject, html, template: "booking_confirm", bypassAutomatedGate: true });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: CoachBookingCommType.COACH_NOTIFICATION,
    audience: CoachBookingCommAudience.COACH,
    recipientEmail: params.coachEmail,
    subject,
    bodyPreview: `${guest} booked a session for ${date}.`,
  }).catch((err) => console.error("[booking-emails] log coach notification", err));
}

export async function sendBookingCancelledEmail(params: {
  coachProfileId: string;
  bookingId?: string | null;
  clientUserId?: string | null;
  guestEmail: string;
  guestName?: string | null;
  coachName: string;
  startAt: string;
  endAt: string;
}) {
  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const name = params.guestName?.trim() || "there";
  const subject = `Cancelled: session with ${params.coachName}`;

  const html = coachEmailShell(
    params.coachName,
    "Session cancelled",
    `<p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
        Hi ${escapeHtml(name.split(" ")[0] ?? name)}, your session with ${escapeHtml(params.coachName)} on
        <strong>${escapeHtml(date)}</strong> (${escapeHtml(time)}) was cancelled.
      </p>`,
  );

  await sendKimchiEmail({ to: params.guestEmail, subject, html, template: "booking_cancel", bypassAutomatedGate: true });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: CoachBookingCommType.CANCELLATION,
    audience: CoachBookingCommAudience.GUEST,
    recipientEmail: params.guestEmail,
    subject,
    bodyPreview: `Session with ${params.coachName} on ${date} was cancelled.`,
  }).catch((err) => console.error("[booking-emails] log cancellation", err));
}

export async function sendBookingRescheduledEmail(params: {
  coachProfileId: string;
  bookingId?: string | null;
  clientUserId?: string | null;
  guestEmail: string;
  guestName?: string | null;
  coachName: string;
  startAt: string;
  endAt: string;
  bookingRef?: string | null;
}) {
  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const name = params.guestName?.trim() || "there";
  const base = appBaseUrl();
  const subject = `Rescheduled: session with ${params.coachName}`;

  const html = coachEmailShell(
    params.coachName,
    `New time confirmed, ${escapeHtml(name.split(" ")[0] ?? name)}.`,
    `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your session with <strong>${escapeHtml(params.coachName)}</strong> was rescheduled.
      </p>
      <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(date)}</strong><br />${escapeHtml(time)}
      </p>
      ${
        params.bookingRef
          ? `<p style="margin:24px 0 0;font-size:14px;color:#52493F;">
              <a href="${base}/coaching/reschedule/${encodeURIComponent(params.bookingRef)}" style="color:#1C3A2F;font-weight:600;">Manage booking</a>
            </p>`
          : ""
      }`,
  );

  await sendKimchiEmail({ to: params.guestEmail, subject, html, template: "booking_reschedule", bypassAutomatedGate: true });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: CoachBookingCommType.GUEST_RESCHEDULED,
    audience: CoachBookingCommAudience.GUEST,
    recipientEmail: params.guestEmail,
    subject,
    bodyPreview: `Session with ${params.coachName} rescheduled to ${date}.`,
  }).catch((err) => console.error("[booking-emails] log reschedule", err));
}

export async function sendBookingReminderEmail(params: {
  coachProfileId: string;
  bookingId: string;
  clientUserId?: string | null;
  guestEmail: string;
  guestName?: string | null;
  coachName: string;
  startAt: string;
  endAt: string;
  window: "24h" | "1h";
}) {
  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const name = params.guestName?.trim() || "there";
  const whenLabel = params.window === "24h" ? "tomorrow" : "in about 1 hour";
  const subject = `Reminder: session with ${params.coachName} ${whenLabel}`;

  const html = coachEmailShell(
    params.coachName,
    `Coming up ${whenLabel}, ${escapeHtml(name.split(" ")[0] ?? name)}.`,
    `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your coaching session with <strong>${escapeHtml(params.coachName)}</strong> is ${whenLabel}.
      </p>
      <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(date)}</strong><br />${escapeHtml(time)}
      </p>`,
  );

  await sendKimchiEmail({ to: params.guestEmail, subject, html, template: "booking_reminder", bypassAutomatedGate: true });

  await logBookingCommunication({
    bookingId: params.bookingId,
    coachProfileId: params.coachProfileId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    type: params.window === "24h" ? CoachBookingCommType.REMINDER_24H : CoachBookingCommType.REMINDER_1H,
    audience: CoachBookingCommAudience.GUEST,
    recipientEmail: params.guestEmail,
    subject,
    bodyPreview: `Reminder: session with ${params.coachName} ${whenLabel}.`,
  }).catch((err) => console.error("[booking-emails] log reminder", err));
}
