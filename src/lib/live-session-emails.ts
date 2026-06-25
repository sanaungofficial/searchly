import { resend } from "@/lib/email";
import { formatSessionDateRange } from "@/lib/live-session-display";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appBase() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.kimchi.so";
}

function liveSessionPath(session: { legacyNumericId: number | null; id: string }) {
  const routeId = session.legacyNumericId != null ? String(session.legacyNumericId) : session.id;
  return `${appBase()}/live/${routeId}`;
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
                <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;">Kimchi Live</p>
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

function ctaButton(href: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="background:#1C3A2F;border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#F2EDE3;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

export async function sendLiveSessionRegistrationEmail(params: {
  email: string;
  name?: string | null;
  session: {
    title: string;
    host: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    legacyNumericId: number | null;
    id: string;
  };
}) {
  if (!process.env.RESEND_API_KEY) return;

  const firstName = params.name?.split(" ")[0] ?? "there";
  const { date, time } = formatSessionDateRange(params.session.scheduledStart, params.session.scheduledEnd);
  const joinUrl = liveSessionPath(params.session);

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: params.email,
    subject: `You're registered — ${params.session.title}`,
    html: emailShell(
      `You're in, ${firstName}.`,
      `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your seat is saved for <strong>${escapeHtml(params.session.title)}</strong> with ${escapeHtml(params.session.host)}.
      </p>
      <p style="margin:0;font-size:14px;color:#6B6258;line-height:1.6;">${escapeHtml(date)} · ${escapeHtml(time)}</p>
      <p style="margin:16px 0 0;font-size:14px;color:#52493F;line-height:1.7;">
        We'll email you before it starts. When we're live, use the same link to join in one click.
      </p>
      ${ctaButton(joinUrl, "View session →")}`
    ),
  });
}

export async function sendLiveSessionReminderEmail(params: {
  email: string;
  name?: string | null;
  session: {
    title: string;
    host: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    legacyNumericId: number | null;
    id: string;
  };
}) {
  if (!process.env.RESEND_API_KEY) return;

  const firstName = params.name?.split(" ")[0] ?? "there";
  const { time } = formatSessionDateRange(params.session.scheduledStart, params.session.scheduledEnd);
  const joinUrl = liveSessionPath(params.session);

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: params.email,
    subject: `Starting soon — ${params.session.title}`,
    html: emailShell(
      `Almost time, ${firstName}.`,
      `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        <strong>${escapeHtml(params.session.title)}</strong> with ${escapeHtml(params.session.host)} starts in about 15 minutes.
      </p>
      <p style="margin:0;font-size:14px;color:#6B6258;">${escapeHtml(time)}</p>
      ${ctaButton(joinUrl, "Join when we're live →")}`
    ),
  });
}

export async function sendLiveSessionLiveNowEmail(params: {
  email: string;
  name?: string | null;
  session: {
    title: string;
    host: string;
    legacyNumericId: number | null;
    id: string;
  };
}) {
  if (!process.env.RESEND_API_KEY) return;

  const firstName = params.name?.split(" ")[0] ?? "there";
  const joinUrl = liveSessionPath(params.session);

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: params.email,
    subject: `● Live now — ${params.session.title}`,
    html: emailShell(
      `We're live, ${firstName}.`,
      `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        ${escapeHtml(params.session.host)} just started <strong>${escapeHtml(params.session.title)}</strong>.
      </p>
      ${ctaButton(joinUrl, "Join now →")}`
    ),
  });
}
