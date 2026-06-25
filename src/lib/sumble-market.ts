import type {
  HirebaseInsightsResponse,
  InsightsKeyCount,
  InsightsTopCompany,
  InsightsTopLocation,
} from "@/lib/hirebase-insights";
import { buildMarketHeadline } from "@/lib/hirebase-insights";
import { filterMarketSkills } from "@/lib/market-skill-filter";
import {
  assertSumbleCreditsAvailable,
  SUMBLE_ESTIMATED_COSTS,
} from "@/lib/sumble-credits";
import { fetchSumbleJobsSearch, type SumbleJobRow } from "@/lib/sumble";

export type SumbleMarketFilters = {
  jobFunctionTerms: string[];
  daysAgo: number;
};

/** Small job sample — one Sumble call, no parallel org search. */
export const MARKET_JOB_SAMPLE_LIMIT = 25;

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
}): HirebaseInsightsResponse {
  const inWindow = jobsInWindow(input.jobs, input.daysAgo);
  const sampleSize = inWindow.length;
  const corpusInWindow = input.jobs.length
    ? Math.round((input.corpusTotal * sampleSize) / input.jobs.length)
    : sampleSize;

  const technologies: string[] = [];
  const projects: string[] = [];
  const levels: string[] = [];
  const locations: string[] = [];
  const companyCounts = new Map<string, { name: string; domain: string | null; count: number }>();
  let remoteCount = 0;
  let remoteKnown = 0;

  for (const job of inWindow) {
    const attrs = job.attributes;
    if (!attrs) continue;

    for (const tech of attrs.technologies ?? []) {
      if (tech.name?.trim()) technologies.push(tech.name.trim());
    }
    for (const proj of attrs.projects ?? []) {
      if (proj.name?.trim()) projects.push(proj.name.trim());
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
    countByKey(projects.length ? projects : technologies),
    25
  );
  const level_breakdown = countByKey(levels);

  const locationCounts = countByKey(locations);
  const top_locations: InsightsTopLocation[] = locationCounts.slice(0, 12).map((l) => ({
    label: l.key,
    count: l.count,
    percent: l.percent,
  }));

  const remotePct = remoteKnown > 0 ? Math.round((remoteCount / remoteKnown) * 100) : undefined;
  const dominantLevel = level_breakdown[0]?.key;

  return {
    headline: {
      total_count: corpusInWindow || sampleSize,
      sample_size: sampleSize,
      new_this_week: newThisWeek(input.jobs),
      pct_remote: remotePct,
      top_company: top_companies[0]?.company_name,
      top_technology: top_technologies[0]?.key,
      dominant_experience_level: dominantLevel,
    },
    top_technologies,
    top_skills,
    top_companies,
    top_locations,
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
  windows: Record<string, HirebaseInsightsResponse>;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const terms = input.jobFunctionTerms.length ? input.jobFunctionTerms : ["Product Management"];
  const corpus = await loadMarketCorpus(terms, input.forceRefresh ?? false);
  const windows: Record<string, HirebaseInsightsResponse> = {};

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
): Promise<{ data: HirebaseInsightsResponse; creditsUsed: number; creditsRemaining: number | null }> {
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
  insight: HirebaseInsightsResponse,
  roleLabel: string,
  daysAgo: number
): string {
  return buildMarketHeadline(insight, roleLabel, daysAgo);
}

export { aggregateJobsToInsights, jobsInWindow };
