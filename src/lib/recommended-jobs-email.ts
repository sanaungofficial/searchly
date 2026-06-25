import { resend } from "@/lib/email";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kimchi-git-dev-second-ladder.vercel.app";

export async function sendRecommendedJobsDigestEmail(input: {
  email: string;
  name: string | null;
  jobs: VectorMatchedJob[];
  totalNew: number;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !input.jobs.length) return false;

  const firstName = input.name?.split(" ")[0] ?? "there";
  const jobRows = input.jobs
    .map(
      (job) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #E5DDD0;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1C3A2F;">${escapeHtml(job.title)}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#6B6258;">${escapeHtml(job.companyName)}${job.isTrackedCompany ? " · Watchlist" : ""}</p>
            <p style="margin:0;font-size:12px;color:#2A6B4A;font-weight:600;">${job.matchScore}/100 · ${escapeHtml(job.matchLabel)}</p>
          </td>
        </tr>`,
    )
    .join("");

  const more =
    input.totalNew > input.jobs.length
      ? `<p style="margin:16px 0 0;font-size:14px;color:#52493F;">+ ${input.totalNew - input.jobs.length} more new matches in your workspace.</p>`
      : "";

  try {
    await resend.emails.send({
      from: "Kimchi <hello@kimchi.so>",
      to: input.email,
      subject:
        input.totalNew === 1
          ? "1 new role matches your profile"
          : `${input.totalNew} new roles match your profile`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#F2EDE3;font-family:'Source Sans 3',system-ui,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:48px 0;">
              <tr>
                <td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFDF9;border:1px solid #E5DDD0;border-radius:16px;overflow:hidden;">
                    <tr>
                      <td style="background:#1C3A2F;padding:32px 40px;">
                        <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;">Kimchi</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="margin:0 0 12px;font-size:24px;font-weight:500;color:#1C3A2F;font-family:Georgia,serif;">Hi ${escapeHtml(firstName)},</p>
                        <p style="margin:0 0 24px;font-size:15px;color:#52493F;line-height:1.7;">
                          We found ${input.totalNew} new recommended ${input.totalNew === 1 ? "role" : "roles"} scoring 80+ against your profile.
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">${jobRows}</table>
                        ${more}
                        <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                          <tr>
                            <td style="background:#1C3A2F;border-radius:10px;">
                              <a href="${APP_URL}/opportunities" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#F2EDE3;text-decoration:none;">
                                View recommendations →
                              </a>
                            </td>
                          </tr>
                        </table>
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
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
