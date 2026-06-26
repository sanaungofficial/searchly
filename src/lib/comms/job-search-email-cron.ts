import { parseJobsCache } from "@/lib/company-jobs-scan";
import { prisma } from "@/lib/prisma";
import {
  sendWatchlistAlertEmail,
  watchlistJobStableId,
} from "@/lib/comms/watchlist-alert-email";
import { runPipelineFollowUpCron } from "@/lib/comms/pipeline-followup-email";

const MAX_WATCHLIST_JOBS = 5;

export type JobSearchEmailCronSummary = {
  watchlistEmailsSent: number;
  pipeline: Awaited<ReturnType<typeof runPipelineFollowUpCron>>;
  errors: string[];
};

/** Daily backstop: watchlist diff from cached jobs + pipeline follow-ups. */
export async function runJobSearchEmailCron(): Promise<JobSearchEmailCronSummary> {
  const summary: JobSearchEmailCronSummary = {
    watchlistEmailsSent: 0,
    pipeline: await runPipelineFollowUpCron(),
    errors: [],
  };

  const users = await prisma.user.findMany({
    where: {
      digestSettings: { watchlistEmailEnabled: true, dailyEmailEnabled: true },
      trackedCompanies: { some: {} },
    },
    include: {
      digestSettings: true,
      trackedCompanies: true,
    },
    take: 150,
  });

  for (const user of users) {
    const settings = user.digestSettings;
    if (!settings) continue;

    const previousIds = new Set(settings.lastWatchlistJobIds ?? []);
    let settingsDirty = false;
    let mergedIds = [...(settings.lastWatchlistJobIds ?? [])];

    for (const company of user.trackedCompanies) {
      const cache = parseJobsCache(company.jobsCache);
      if (!cache?.jobs.length) continue;

      const companyJobIds = cache.jobs.map((job) =>
        watchlistJobStableId(company.id, company.name, job),
      );

      // Bootstrap: seed known jobs without emailing historical cache on first run.
      if (!settings.lastWatchlistSentAt && mergedIds.length === 0) {
        mergedIds = [...new Set([...mergedIds, ...companyJobIds])].slice(-200);
        settingsDirty = true;
        continue;
      }

      const newJobs = cache.jobs.filter(
        (job) => !previousIds.has(watchlistJobStableId(company.id, company.name, job)),
      );
      if (!newJobs.length) continue;

      try {
        const sent = await sendWatchlistAlertEmail({
          email: user.email,
          name: user.name,
          userId: user.id,
          companyName: company.name,
          jobs: newJobs.slice(0, MAX_WATCHLIST_JOBS),
          totalNew: newJobs.length,
        });
        if (sent) {
          summary.watchlistEmailsSent += 1;
          const merged = [
            ...new Set([
              ...(settings.lastWatchlistJobIds ?? []),
              ...newJobs.map((j) => watchlistJobStableId(company.id, company.name, j)),
            ]),
          ].slice(-200);
          await prisma.userDigestSettings.update({
            where: { userId: user.id },
            data: {
              lastWatchlistSentAt: new Date(),
              lastWatchlistJobIds: merged,
            },
          });
          for (const id of merged) previousIds.add(id);
          mergedIds = merged;
          settingsDirty = true;
        }
      } catch (err) {
        summary.errors.push(`${user.email}/${company.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (settingsDirty) {
      await prisma.userDigestSettings.update({
        where: { userId: user.id },
        data: {
          lastWatchlistJobIds: mergedIds,
          ...(settings.lastWatchlistSentAt ? {} : { lastWatchlistSentAt: new Date() }),
        },
      });
    }
  }

  return summary;
}
