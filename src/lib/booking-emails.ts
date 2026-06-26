import { resend } from "@/lib/email";
import { formatBookingWhen } from "@/lib/booking-display";
import { nylasOAuthAppUrl } from "@/lib/nylas";
import { logBookingCommunication } from "@/lib/booking-communications";
import { CoachBookingCommAudience, CoachBookingCommType } from "@prisma/client";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appBase() {
  return nylasOAuthAppUrl();
}

function emailShell(title: string, bodyHtml: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="margin:0;padding:0;background:#F2EDE3;font-family:'Source Sans 3',system-ui,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:48px 0;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFDF9;border:1px solid #E5DDD0;border-radius:16px;overflow:hidden;">
              <tr><td style="background:#1C3A2F;padding:32px 40px;">
                <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;">Kimchi</p>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="margin:0 0 16px;font-size:24px;font-weight:500;color:#1C3A2F;font-style:italic;font-family:Georgia,serif;">${escapeHtml(title)}</p>
                ${bodyHtml}
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;
}

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
  if (!process.env.RESEND_API_KEY) return;

  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const name = params.guestName?.trim() || "there";
  const ref = params.bookingRef;
  const base = appBase();
  const subject = `Confirmed: ${params.title ?? `Session with ${params.coachName}`}`;

  const actions = ref
    ? `<p style="margin:24px 0 0;font-size:14px;color:#52493F;line-height:1.7;">
        <a href="${base}/coaching/reschedule/${encodeURIComponent(ref)}" style="color:#1C3A2F;font-weight:600;">Reschedule</a>
        ·
        <a href="${base}/coaching/cancel/${encodeURIComponent(ref)}" style="color:#1C3A2F;font-weight:600;">Cancel</a>
      </p>`
    : "";

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: params.guestEmail,
    subject,
    html: emailShell(
      `You're booked, ${escapeHtml(name.split(" ")[0] ?? name)}.`,
      `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
          Your coaching session with <strong>${escapeHtml(params.coachName)}</strong> is confirmed.
        </p>
        <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
          <strong>${escapeHtml(date)}</strong><br />${escapeHtml(time)}
        </p>
        ${actions}
        <p style="margin:24px 0 0;font-size:14px;color:#6B6258;">A calendar invite should arrive separately from your coach's calendar.</p>`,
    ),
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
  if (!process.env.RESEND_API_KEY || !params.coachEmail) return;

  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const guest = params.guestName?.trim() || params.guestEmail || "A seeker";
  const base = appBase();
  const subject = `New booking: ${guest}`;

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: params.coachEmail,
    subject,
    html: emailShell(
      "New coaching session booked",
      `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
          <strong>${escapeHtml(guest)}</strong>${params.guestEmail ? ` (${escapeHtml(params.guestEmail)})` : ""} booked a session with you.
        </p>
        <p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
          <strong>${escapeHtml(date)}</strong><br />${escapeHtml(time)}
        </p>
        <p style="margin:24px 0 0;">
          <a href="${base}/dashboard/clients" style="display:inline-block;padding:12px 20px;background:#1C3A2F;color:#F2EDE3;text-decoration:none;font-size:14px;font-weight:600;border-radius:10px;">
            View in Kimchi →
          </a>
        </p>`,
    ),
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
  if (!process.env.RESEND_API_KEY) return;

  const { date, time } = formatBookingWhen(params.startAt, params.endAt);
  const name = params.guestName?.trim() || "there";
  const subject = `Cancelled: session with ${params.coachName}`;

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: params.guestEmail,
    subject,
    html: emailShell(
      "Session cancelled",
      `<p style="margin:0;font-size:15px;color:#52493F;line-height:1.7;">
          Hi ${escapeHtml(name.split(" ")[0] ?? name)}, your session with ${escapeHtml(params.coachName)} on
          <strong>${escapeHtml(date)}</strong> (${escapeHtml(time)}) was cancelled.
        </p>`,
    ),
  });

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
