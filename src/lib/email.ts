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
    from: "Searchly <hello@searchly.co>",
    to: email,
    subject: "You're in. Let's get you hired.",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="margin:0;padding:0;background:#F2EDE3;font-family:'DM Sans',system-ui,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:48px 0;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFDF9;border:1px solid #E5DDD0;border-radius:16px;overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:#1C3A2F;padding:32px 40px;">
                      <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;letter-spacing:-0.3px;">Searchly</p>
                      <p style="margin:4px 0 0;font-size:10px;color:rgba(232,213,163,0.4);letter-spacing:1px;text-transform:uppercase;">by Second Ladder</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 16px;font-size:26px;font-weight:500;color:#1C3A2F;font-style:italic;font-family:Georgia,serif;">
                        Welcome, ${firstName}.
                      </p>
                      <p style="margin:0 0 16px;font-size:15px;color:#52493F;line-height:1.7;">
                        Your Searchly workspace is ready. Upload your resume, paste in a few job URLs, and we'll get to work — tailored applications, cover letters, and fit analysis, all in one place.
                      </p>
                      <p style="margin:0 0 32px;font-size:15px;color:#52493F;line-height:1.7;">
                        Most people see their first tailored application ready within minutes of onboarding.
                      </p>
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#1C3A2F;border-radius:10px;">
                            <a href="https://searchly-roan.vercel.app" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#F2EDE3;text-decoration:none;">
                              Open your workspace →
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 40px;border-top:1px solid #E5DDD0;">
                      <p style="margin:0;font-size:12px;color:#A09890;line-height:1.6;">
                        You're receiving this because you signed up for Searchly. Questions? Reply to this email.
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
