import { jobListingUrlDedupeKey } from "@/lib/cached-job";
import type { CachedJob } from "@/lib/cached-job";
import { ctaButton, emailShell, escapeHtml, appBaseUrl } from "@/lib/comms/email-shell";
import { sendKimchiEmail } from "@/lib/comms/send-email";
import { digestUnsubscribeUrl } from "@/lib/digest-unsubscribe";
import { prisma } from "@/lib/prisma";

const MAX_WATCHLIST_JOBS = 5;

export function watchlistJobStableId(trackedCompanyId: string, companyName: string, job: CachedJob): string {
  const key = jobListingUrlDedupeKey({
    companyName,
    title: job.title,
    url: job.url,
    hirebaseId: job.hirebaseId,
  });
  return `${trackedCompanyId}:${key}`;
}

export function detectNewWatchlistJobs(
  trackedCompanyId: string,
  companyName: string,
  oldJobs: CachedJob[],
  newJobs: CachedJob[],
  previousIds: Set<string>,
): CachedJob[] {
  const oldKeys = new Set(
    oldJobs.map((j) =>
      jobListingUrlDedupeKey({
        companyName,
        title: j.title,
        url: j.url,
        hirebaseId: j.hirebaseId,
      }),
    ),
  );

  const fresh: CachedJob[] = [];
  for (const job of newJobs) {
    const listingKey = jobListingUrlDedupeKey({
      companyName,
      title: job.title,
      url: job.url,
      hirebaseId: job.hirebaseId,
    });
    const stableId = `${trackedCompanyId}:${listingKey}`;
    if (previousIds.has(stableId)) continue;
    if (oldKeys.has(listingKey)) continue;
    fresh.push(job);
  }
  return fresh;
}

export async function sendWatchlistAlertEmail(input: {
  email: string;
  name: string | null;
  userId: string;
  companyName: string;
  jobs: CachedJob[];
  totalNew: number;
}): Promise<boolean> {
  if (!input.jobs.length) return false;

  const firstName = input.name?.split(" ")[0] ?? "there";
  const cards = input.jobs
    .slice(0, MAX_WATCHLIST_JOBS)
    .map(
      (job) => `<tr><td style="padding:12px 0;border-bottom:1px solid #E5DDD0;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1C3A2F;">${escapeHtml(job.title)}</p>
        <p style="margin:0;font-size:13px;color:#6B6258;">${escapeHtml(input.companyName)}${job.location ? ` · ${escapeHtml(job.location)}` : ""}</p>
      </td></tr>`,
    )
    .join("");

  const more =
    input.totalNew > input.jobs.length
      ? `<p style="margin:16px 0 0;font-size:14px;color:#52493F;">+ ${input.totalNew - input.jobs.length} more new ${input.totalNew - input.jobs.length === 1 ? "role" : "roles"} at ${escapeHtml(input.companyName)}.</p>`
      : "";

  const subject =
    input.jobs.length === 1
      ? `New at ${input.companyName}: ${input.jobs[0].title}`
      : `${input.totalNew} new roles at ${input.companyName}`;

  const html = emailShell({
    subtitle: "Watchlist alert",
    title: `New roles at ${input.companyName}, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 20px;font-size:15px;color:#52493F;line-height:1.7;">
        We found ${input.totalNew === 1 ? "a new opening" : `${input.totalNew} new openings`} at a company on your watchlist.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
      ${more}
      ${ctaButton(`${appBaseUrl()}/opportunities/companies`, "View watchlist →")}`,
    footerHtml: `<p style="margin:0 0 8px;font-size:12px;color:#6B6258;line-height:1.6;">
        Watchlist alerts are separate from your daily job match digest.
      </p>
      <p style="margin:0;font-size:12px;color:#6B6258;line-height:1.6;">
        <a href="${digestUnsubscribeUrl(input.userId)}" style="color:#2A6B4A;text-decoration:underline;">Unsubscribe from job emails</a>
        &nbsp;·&nbsp; Manage all preferences in Kimchi settings.
      </p>`,
  });

  const result = await sendKimchiEmail({
    to: input.email,
    subject,
    html,
    template: "watchlist_alert",
  });
  return result.sent;
}

export async function maybeSendWatchlistAlertAfterScan(input: {
  userId: string;
  email: string;
  name: string | null;
  trackedCompanyId: string;
  companyName: string;
  oldCache: CachedJob[];
  newCache: CachedJob[];
}): Promise<boolean> {
  const settings = await prisma.userDigestSettings.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId },
    update: {},
  });

  if (!settings.watchlistEmailEnabled || !settings.dailyEmailEnabled) return false;

  const previousIds = new Set(settings.lastWatchlistJobIds ?? []);
  const newJobs = detectNewWatchlistJobs(
    input.trackedCompanyId,
    input.companyName,
    input.oldCache,
    input.newCache,
    previousIds,
  );
  if (!newJobs.length) return false;

  const sent = await sendWatchlistAlertEmail({
    email: input.email,
    name: input.name,
    userId: input.userId,
    companyName: input.companyName,
    jobs: newJobs.slice(0, MAX_WATCHLIST_JOBS),
    totalNew: newJobs.length,
  });

  if (sent) {
    const allIds = newJobs.map((j) => watchlistJobStableId(input.trackedCompanyId, input.companyName, j));
    const merged = [...new Set([...(settings.lastWatchlistJobIds ?? []), ...allIds])].slice(-200);
    await prisma.userDigestSettings.update({
      where: { userId: input.userId },
      data: {
        lastWatchlistSentAt: new Date(),
        lastWatchlistJobIds: merged,
      },
    });
  }

  return sent;
}
