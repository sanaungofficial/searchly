import { sendKimchiEmail } from "@/lib/comms/send-email";
import { matchScoreStyle } from "@/lib/match-score";
import { FRESHNESS_COLORS, getJobFreshness } from "@/lib/job-posted-freshness";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";

export type DigestEmailContent = {
  subject: string;
  html: string;
};

export function buildRecommendedJobsDigestEmail(input: {
  name: string | null;
  jobs: VectorMatchedJob[];
  totalNew: number;
  unsubscribeUrl: string;
}): DigestEmailContent {
  const firstName = input.name?.split(" ")[0] ?? "there";
  const jobCards = input.jobs.map((job) => renderJobCard(job)).join("");

  const more =
    input.totalNew > input.jobs.length
      ? `<p style="margin:20px 0 0;font-size:14px;color:#52493F;line-height:1.6;">+ ${input.totalNew - input.jobs.length} more new ${input.totalNew - input.jobs.length === 1 ? "match" : "matches"} waiting in your workspace.</p>`
      : "";

  const subject =
    input.jobs.length === 1
      ? `Strong match: ${input.jobs[0].title} at ${input.jobs[0].companyName}`
      : `${input.jobs.length} roles that match your profile`;

  const html = `<!DOCTYPE html>
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
            <tr>
              <td style="background:#1C3A2F;padding:32px 40px;">
                <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;">Kimchi</p>
                <p style="margin:4px 0 0;font-size:11px;color:rgba(232,213,163,0.55);">Your daily job matches</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;">
                <p style="margin:0 0 12px;font-size:24px;font-weight:500;color:#1C3A2F;font-family:Georgia,serif;">Hi ${escapeHtml(firstName)},</p>
                <p style="margin:0 0 28px;font-size:15px;color:#52493F;line-height:1.7;">
                  We found ${input.totalNew === 1 ? "a strong match" : `${input.totalNew} good matches`} for your profile.
                  Here ${input.jobs.length === 1 ? "is your top pick" : "are your top picks"} — with scores and why each role fits.
                </p>
                ${jobCards}
                ${more}
                <table cellpadding="0" cellspacing="0" style="margin-top:32px;">
                  <tr>
                    <td style="background:#1C3A2F;border-radius:10px;">
                      <a href="${APP_URL}/opportunities/pipeline" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#F2EDE3;text-decoration:none;">
                        View all recommendations →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #E5DDD0;">
                <p style="margin:0 0 8px;font-size:12px;color:#6B6258;line-height:1.6;">
                  You receive up to 3 matched roles per day from Kimchi. Scores are based on your resume, target roles, and how closely each posting aligns with your background.
                </p>
                <p style="margin:0;font-size:12px;color:#6B6258;line-height:1.6;">
                  <a href="${input.unsubscribeUrl}" style="color:#2A6B4A;text-decoration:underline;">Unsubscribe</a>
                  &nbsp;·&nbsp;
                  Questions? Reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

export async function sendRecommendedJobsDigestEmail(input: {
  email: string;
  name: string | null;
  jobs: VectorMatchedJob[];
  totalNew: number;
  unsubscribeUrl: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !input.jobs.length) return false;

  const { subject, html } = buildRecommendedJobsDigestEmail({
    name: input.name,
    jobs: input.jobs,
    totalNew: input.totalNew,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const result = await sendKimchiEmail({
    to: input.email,
    subject,
    html,
    template: "job_digest",
  });
  return result.sent;
}

function renderJobCard(job: VectorMatchedJob): string {
  const style = matchScoreStyle(job.matchScore);
  const location = job.location?.trim();
  const freshness = getJobFreshness(job.datePosted);
  const freshnessColors = FRESHNESS_COLORS[freshness.level];
  const reasons = (job.matchReasons ?? []).slice(0, 2);
  const reasonBullets = reasons
    .map(
      (r) =>
        `<li style="margin:0 0 6px;font-size:13px;color:#52493F;line-height:1.55;">${escapeHtml(r)}</li>`,
    )
    .join("");

  const watchlistBadge = job.isTrackedCompany
    ? `<span style="display:inline-block;margin-left:6px;font-size:11px;font-weight:600;color:#1C3A2F;background:rgba(26,58,47,0.1);padding:2px 8px;border-radius:4px;">Watchlist</span>`
    : "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #E5DDD0;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1C3A2F;">${escapeHtml(job.title)}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#6B6258;">
            ${escapeHtml(job.companyName)}${watchlistBadge}${location ? ` · ${escapeHtml(location)}` : ""}
          </p>
          ${
            job.datePosted
              ? `<p style="margin:0 0 10px;font-size:12px;font-weight:600;color:${freshnessColors.text};">
                   <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${freshnessColors.dot};margin-right:6px;vertical-align:middle;"></span>
                   ${escapeHtml(freshness.cardLabel)}
                 </p>`
              : ""
          }
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${style.accent};">
            ${job.matchScore}/100 · ${escapeHtml(job.matchLabel)} match
          </p>
          ${
            reasonBullets
              ? `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#8A7F72;text-transform:uppercase;letter-spacing:0.06em;">Why this fits</p>
                 <ul style="margin:0 0 14px;padding-left:18px;">${reasonBullets}</ul>`
              : ""
          }
          <a href="${APP_URL}/opportunities/pipeline" style="font-size:13px;font-weight:600;color:#2A6B4A;text-decoration:none;">View in Kimchi →</a>
        </td>
      </tr>
    </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
