import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
export const resend = { emails: { send: (...args: Parameters<Resend["emails"]["send"]>) => getResend().emails.send(...args) } };

export async function sendWelcomeEmail(email: string, name: string | null) {
  const firstName = name?.split(" ")[0] ?? "there";

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to: email,
    subject: "Welcome to Kimchi",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="margin:0;padding:0;background:#F2EDE3;font-family:'Source Sans 3',system-ui,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:48px 0;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFDF9;border:1px solid #E5DDD0;border-radius:16px;overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:#1C3A2F;padding:32px 40px;">
                      <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;letter-spacing:-0.3px;">Kimchi</p>
                      <p style="margin:4px 0 0;font-size:11px;color:rgba(232,213,163,0.55);letter-spacing:0.02em;">by <span style="font-weight:500;">Second Ladder</span></p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 16px;font-size:26px;font-weight:500;color:#1C3A2F;font-style:italic;font-family:Georgia,serif;">
                        Welcome, ${firstName}.
                      </p>
                      <p style="margin:0 0 16px;font-size:15px;color:#52493F;line-height:1.7;">
                        Your account is ready. Upload your resume, add a job to your pipeline, and we'll help you tailor applications from there — cover letters, fit scores, and edits when you need them.
                      </p>
                      <p style="margin:0 0 32px;font-size:15px;color:#52493F;line-height:1.7;">
                        Scout's in the sidebar if you want a second read on a role or a draft.
                      </p>
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#1C3A2F;border-radius:10px;">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.secondladder.com"}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#F2EDE3;text-decoration:none;">
                              Go to Kimchi →
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 40px;border-top:1px solid #E5DDD0;">
                      <p style="margin:0;font-size:12px;color:#6B6258;line-height:1.6;">
                        You're receiving this because you signed up for Kimchi. Questions? Reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export async function sendDiscoveryLeadEmail(
  context: import("@/lib/discovery-lead").DiscoveryLeadContext,
  payload: import("@/lib/discovery-lead").DiscoveryLeadPayload,
) {
  const to = process.env.DISCOVERY_LEAD_EMAIL ?? "sanhaung1@gmail.com";
  const targetRole = context.targetRoles[0] ?? "—";
  const rows = [
    ["Name", context.name ?? "—"],
    ["Email", context.email],
    ["Phone", payload.phone?.trim() || "—"],
    ["Target role", targetRole],
    ["Timeline", context.jobTimeline ?? "—"],
    ["Target salary", context.targetSalary ?? "—"],
    ["LinkedIn", context.linkedinUrl ?? "—"],
    ["Biggest blocker", payload.blocker],
    ["Target companies", payload.targetCompanies?.trim() || "—"],
    ["Best time to reach", payload.preferredContactTime?.trim() || "—"],
    ["Pipeline", context.pipelineSummary],
    ["Notes", payload.notes?.trim() || "—"],
    ["Trigger", payload.trigger ?? "—"],
    ["User ID", context.userId],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #E5DDD0;font-size:13px;color:#6B6258;width:140px;vertical-align:top;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #E5DDD0;font-size:14px;color:#1C3A2F;">${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to,
    replyTo: context.email,
    subject: `[Kimchi lead] ${context.name ?? context.email} — ${payload.blocker.slice(0, 40)}`,
    html: `
      <!DOCTYPE html>
      <html><body style="margin:0;padding:24px;background:#F2EDE3;font-family:system-ui,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFDF9;border:1px solid #E5DDD0;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#1C3A2F;padding:20px 24px;">
            <p style="margin:0;font-size:18px;font-weight:600;color:#E8D5A3;">Strategy call request</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(232,213,163,0.5);">Kimchi · Second Ladder</p>
          </td></tr>
          <tr><td style="padding:8px 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
          </td></tr>
        </table>
      </body></html>
    `,
  });
}

export async function sendEventInterestEmail(
  context: import("@/lib/event-interest-lead").EventInterestContext,
  payload: import("@/lib/event-interest-lead").EventInterestPayload,
) {
  const to = process.env.EVENT_INTEREST_EMAIL ?? process.env.DISCOVERY_LEAD_EMAIL ?? "sanhaung1@gmail.com";
  const rows = [
    ["Name", context.name ?? "—"],
    ["Email", context.email],
    ["Target roles", context.targetRoles.join(", ") || "—"],
    ["Dashboard goals", context.dashboardGoals.join(", ") || "—"],
    ["Topics requested", payload.topics.trim()],
    ["Notes", payload.notes?.trim() || "—"],
    ["User ID", context.userId],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #E5DDD0;font-size:13px;color:#6B6258;width:140px;vertical-align:top;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #E5DDD0;font-size:14px;color:#1C3A2F;">${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");

  await resend.emails.send({
    from: "Kimchi <hello@kimchi.so>",
    to,
    replyTo: context.email,
    subject: `[Kimchi events] Topic interest — ${context.name ?? context.email}`,
    html: `
      <!DOCTYPE html>
      <html><body style="margin:0;padding:24px;background:#F2EDE3;font-family:system-ui,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFDF9;border:1px solid #E5DDD0;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#1C3A2F;padding:20px 24px;">
            <p style="margin:0;font-size:18px;font-weight:600;color:#E8D5A3;">Live session topic interest</p>
          </td></tr>
          <tr><td style="padding:8px 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
          </td></tr>
        </table>
      </body></html>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
