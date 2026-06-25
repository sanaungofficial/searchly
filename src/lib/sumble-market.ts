import type {
  InsightsKeyCount,
  InsightsTopCompany,
  InsightsTopLocation,
  MarketProjectTrend,
  MarketTrendsWindow,
} from "@/lib/market-trends-types";
import { buildMarketHeadline } from "@/lib/market-trends-types";
import { filterMarketSkills } from "@/lib/market-skill-filter";
import { jobPostMentionsAi, technologyMentionsAi } from "@/lib/market-trend-analysis";
import {
  assertSumbleCreditsAvailable,
  SUMBLE_ESTIMATED_COSTS,
} from "@/lib/sumble-credits";
import { fetchSumbleJobsSearch, type SumbleJobRow } from "@/lib/sumble";

export type SumbleMarketFilters = {
  jobFunctionTerms: string[];
  daysAgo: number;
};

/** Job sample for trend extraction — one Sumble search call. */
export const MARKET_JOB_SAMPLE_LIMIT = 50;

function cutoffDate(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function slugifyCompany(name: string, domain?: string | null): string {
  if (domain?.trim()) return domain.trim().toLowerCase().replace(/^www\./, "");
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countByKey(items: string[]): InsightsKeyCount[] {
  const counts = new Map<string, number>();
  for (const raw of items) {
    const key = raw.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

function isRemoteLocation(location: string | null | undefined): boolean | null {
  if (!location?.trim()) return null;
  const lower = location.toLowerCase();
  if (lower.includes("remote")) return true;
  if (lower.includes("hybrid")) return null;
  if (lower.includes("on-site") || lower.includes("onsite") || lower.includes("in-person")) return false;
  return null;
}

function jobsInWindow(jobs: SumbleJobRow[], daysAgo: number): SumbleJobRow[] {
  const cutoff = cutoffDate(daysAgo);
  return jobs.filter((job) => {
    const posted = job.attributes?.posted_date;
    if (!posted) return true;
    const t = new Date(posted).getTime();
    return !Number.isNaN(t) && t >= cutoff.getTime();
  });
}

function newThisWeek(jobs: SumbleJobRow[]): number {
  return jobsInWindow(jobs, 7).length;
}

function aggregateJobsToInsights(input: {
  jobs: SumbleJobRow[];
  corpusTotal: number;
  daysAgo: number;
}): MarketTrendsWindow {
  const inWindow = jobsInWindow(input.jobs, input.daysAgo);
  const sampleSize = inWindow.length;
  const corpusInWindow = input.jobs.length
    ? Math.round((input.corpusTotal * sampleSize) / input.jobs.length)
    : sampleSize;

  const technologies: string[] = [];
  const projectNames: string[] = [];
  const levels: string[] = [];
  const locations: string[] = [];
  const projectCounts = new Map<string, MarketProjectTrend>();
  const companyCounts = new Map<string, { name: string; domain: string | null; count: number }>();
  let remoteCount = 0;
  let remoteKnown = 0;
  let aiRelatedCount = 0;

  for (const job of inWindow) {
    const attrs = job.attributes;
    if (!attrs) continue;

    const jobTechs: string[] = [];
    for (const tech of attrs.technologies ?? []) {
      if (tech.name?.trim()) {
        const name = tech.name.trim();
        technologies.push(name);
        jobTechs.push(name);
      }
    }

    const jobProjectNames: string[] = [];
    const jobProjectGoals: string[] = [];
    for (const proj of attrs.projects ?? []) {
      if (proj.name?.trim()) {
        const name = proj.name.trim();
        projectNames.push(name);
        jobProjectNames.push(name);
        if (proj.goal?.trim()) jobProjectGoals.push(proj.goal.trim());
        const key = proj.slug || name;
        const prev = projectCounts.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          projectCounts.set(key, {
            key,
            name,
            goal: proj.goal ?? null,
            count: 1,
          });
        }
      }
    }

    for (const level of attrs.job_levels ?? []) {
      if (level.name?.trim()) levels.push(level.name.trim());
    }
    if (attrs.location?.trim()) locations.push(attrs.location.trim());

    const remote = isRemoteLocation(attrs.location);
    if (remote != null) {
      remoteKnown += 1;
      if (remote) remoteCount += 1;
    }

    if (
      jobPostMentionsAi({
        title: attrs.title,
        technologies: jobTechs,
        projectNames: jobProjectNames,
        projectGoals: jobProjectGoals,
      })
    ) {
      aiRelatedCount += 1;
    }

    const org = attrs.organization;
    if (org?.name?.trim()) {
      const key = String(org.organization_id ?? org.name);
      const prev = companyCounts.get(key);
      companyCounts.set(key, {
        name: org.name.trim(),
        domain: org.domain ?? null,
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  const top_companies: InsightsTopCompany[] = [...companyCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)
    .map((co) => ({
      company_name: co.name,
      company_slug: slugifyCompany(co.name, co.domain),
      company_logo: null,
      count: co.count,
      percent: sampleSize ? Math.round((co.count / sampleSize) * 1000) / 10 : undefined,
    }));

  const top_technologies = filterMarketSkills(countByKey(technologies), 25);
  const top_skills = filterMarketSkills(
    countByKey(projectNames.length ? projectNames : technologies),
    25
  );
  const ai_technologies = top_technologies.filter((t) => technologyMentionsAi(t.key));
  const level_breakdown = countByKey(levels);

  const top_projects = [...projectCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((p) => ({
      ...p,
      percent: sampleSize ? Math.round((p.count / sampleSize) * 1000) / 10 : undefined,
    }));

  const locationCounts = countByKey(locations);
  const top_locations: InsightsTopLocation[] = locationCounts.slice(0, 12).map((l) => ({
    label: l.key,
    count: l.count,
    percent: l.percent,
  }));

  const remotePct = remoteKnown > 0 ? Math.round((remoteCount / remoteKnown) * 100) : undefined;
  const aiPct = sampleSize > 0 ? Math.round((aiRelatedCount / sampleSize) * 1000) / 10 : undefined;

  return {
    headline: {
      total_count: corpusInWindow || sampleSize,
      sample_size: sampleSize,
      new_this_week: newThisWeek(input.jobs),
      pct_remote: remotePct,
      top_company: top_companies[0]?.company_name,
      top_technology: top_technologies[0]?.key,
      dominant_experience_level: level_breakdown[0]?.key,
      pct_ai_related: aiPct,
      ai_related_count: aiRelatedCount,
    },
    top_technologies,
    top_skills,
    top_companies,
    top_locations,
    top_projects,
    ai_technologies,
    level_breakdown,
    location_type_split: remotePct != null
      ? [
          { key: "Remote", count: remoteCount, percent: remotePct },
          {
            key: "Other",
            count: remoteKnown - remoteCount,
            percent: Math.round(((remoteKnown - remoteCount) / remoteKnown) * 1000) / 10,
          },
        ]
      : [],
    generated_at: new Date().toISOString(),
    cached: false,
  };
}

type MarketCorpusCache = {
  jobs: SumbleJobRow[];
  total: number;
  creditsUsed: number;
  creditsRemaining: number | null;
};

const corpusCache = new Map<string, { data: MarketCorpusCache; expiresAt: number }>();
const CORPUS_TTL_MS = 24 * 60 * 60 * 1000;

function corpusCacheKey(terms: string[]): string {
  return terms.join("|");
}

async function loadMarketCorpus(
  jobFunctionTerms: string[],
  forceRefresh: boolean
): Promise<MarketCorpusCache> {
  const key = corpusCacheKey(jobFunctionTerms);
  if (!forceRefresh) {
    const hit = corpusCache.get(key);
    if (hit && Date.now() < hit.expiresAt) return hit.data;
  }

  assertSumbleCreditsAvailable(SUMBLE_ESTIMATED_COSTS.marketSample);

  const primaryTerm = jobFunctionTerms[0] ?? "Product Management";
  const jobsResult = await fetchSumbleJobsSearch({
    jobFunctionTerm: primaryTerm,
    limit: MARKET_JOB_SAMPLE_LIMIT,
  });

  const data: MarketCorpusCache = {
    jobs: jobsResult.jobs,
    total: jobsResult.total,
    creditsUsed: jobsResult.creditsUsed,
    creditsRemaining: jobsResult.creditsRemaining,
  };

  corpusCache.set(key, { data, expiresAt: Date.now() + CORPUS_TTL_MS });
  return data;
}

export async function buildSumbleMarketWindows(input: {
  jobFunctionTerms: string[];
  windows: number[];
  forceRefresh?: boolean;
}): Promise<{
  windows: Record<string, MarketTrendsWindow>;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const terms = input.jobFunctionTerms.length ? input.jobFunctionTerms : ["Product Management"];
  const corpus = await loadMarketCorpus(terms, input.forceRefresh ?? false);
  const windows: Record<string, MarketTrendsWindow> = {};

  for (const days of input.windows) {
    windows[String(days)] = aggregateJobsToInsights({
      jobs: corpus.jobs,
      corpusTotal: corpus.total,
      daysAgo: days,
    });
  }

  return {
    windows,
    creditsUsed: corpus.creditsUsed,
    creditsRemaining: corpus.creditsRemaining,
  };
}

export async function fetchSumbleMarketInsights(
  filters: SumbleMarketFilters,
  forceRefresh = false
): Promise<{ data: MarketTrendsWindow; creditsUsed: number; creditsRemaining: number | null }> {
  const terms = filters.jobFunctionTerms.length
    ? filters.jobFunctionTerms
    : ["Product Management"];

  const corpus = await loadMarketCorpus(terms, forceRefresh);
  const data = aggregateJobsToInsights({
    jobs: corpus.jobs,
    corpusTotal: corpus.total,
    daysAgo: filters.daysAgo,
  });

  return {
    data,
    creditsUsed: corpus.creditsUsed,
    creditsRemaining: corpus.creditsRemaining,
  };
}

export function buildSumbleMarketHeadline(
  insight: MarketTrendsWindow,
  roleLabel: string,
  daysAgo: number
): string {
  return buildMarketHeadline(insight, roleLabel, daysAgo);
}

export { aggregateJobsToInsights, jobsInWindow };
