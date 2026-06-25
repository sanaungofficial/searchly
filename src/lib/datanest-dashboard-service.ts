import { prisma } from "@/lib/prisma";
import {
  fetchDatanestTrending,
  isDatanestConfigured,
  type DataNestTrendingCategoryRow,
  type DataNestTrendingJobRow,
} from "@/lib/datanest";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";

const TTL_MS = 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;

export type DataNestTrendingJob = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  postedAgo: string;
};

export type DataNestTrendingCategory = {
  category: string;
  liveListingCount: number | null;
  topJobs: DataNestTrendingJob[];
  error?: string;
};

export type DataNestTopEmployer = {
  company: string;
  jobCount: number;
  sampleTitles: string[];
};

export type DataNestDashboardBundle = {
  configured: boolean;
  targetRoles: string[];
  roleLabel: string;
  headline: string;
  trending: DataNestTrendingCategory[];
  matchedCategories: DataNestTrendingCategory[];
  topEmployers: DataNestTopEmployer[];
  totalLiveListings: number;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  error?: string;
};

function roleLabelFromTitles(titles: string[]): string {
  if (!titles.length) return "your target roles";
  if (titles.length === 1) return titles[0];
  return titles.slice(0, 2).join(" · ");
}

function defaultTitles(titles: string[]): string[] {
  if (titles.length) return titles.slice(0, 5);
  return ["Product Manager"];
}

function mapJob(row: DataNestTrendingJobRow): DataNestTrendingJob {
  return {
    jobId: row.job_id,
    title: row.title,
    company: row.company,
    location: row.location,
    postedAgo: row.posted_ago,
  };
}

function mapCategory(row: DataNestTrendingCategoryRow): DataNestTrendingCategory {
  return {
    category: row.category,
    liveListingCount: row.live_listing_count_sample ?? null,
    topJobs: (row.top_jobs ?? []).map(mapJob),
    error: row.error,
  };
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function categoryMatchesRole(category: string, role: string): boolean {
  const c = normalizeRole(category);
  const r = normalizeRole(role);
  if (c === r) return true;
  if (c.includes(r) || r.includes(c)) return true;
  const cTokens = new Set(c.split(/[\s/,-]+/).filter(Boolean));
  const rTokens = r.split(/[\s/,-]+/).filter(Boolean);
  return rTokens.some((token) => token.length > 2 && cTokens.has(token));
}

function matchCategoriesForRoles(
  categories: DataNestTrendingCategory[],
  roles: string[]
): DataNestTrendingCategory[] {
  const matched: DataNestTrendingCategory[] = [];
  const seen = new Set<string>();
  for (const role of roles) {
    for (const category of categories) {
      if (category.error || !category.topJobs.length) continue;
      if (!categoryMatchesRole(category.category, role)) continue;
      if (seen.has(category.category)) continue;
      seen.add(category.category);
      matched.push(category);
    }
  }
  return matched;
}

function buildTopEmployers(categories: DataNestTrendingCategory[]): DataNestTopEmployer[] {
  const counts = new Map<string, { count: number; titles: string[] }>();
  for (const category of categories) {
    for (const job of category.topJobs) {
      const company = job.company.trim();
      if (!company) continue;
      const entry = counts.get(company) ?? { count: 0, titles: [] };
      entry.count += 1;
      if (entry.titles.length < 2 && !entry.titles.includes(job.title)) {
        entry.titles.push(job.title);
      }
      counts.set(company, entry);
    }
  }
  return [...counts.entries()]
    .map(([company, { count, titles }]) => ({ company, jobCount: count, sampleTitles: titles }))
    .sort((a, b) => b.jobCount - a.jobCount)
    .slice(0, 8);
}

function buildHeadline(
  matched: DataNestTrendingCategory[],
  roles: string[],
  totalLiveListings: number
): string {
  if (matched.length) {
    const primary = matched[0];
    const employers = [...new Set(primary.topJobs.map((j) => j.company))].slice(0, 3);
    const countLabel =
      primary.liveListingCount != null
        ? `${primary.liveListingCount.toLocaleString()} active listings sampled`
        : "active hiring";
    const employerLabel = employers.length ? ` — ${employers.join(", ")} hiring now` : "";
    return `${primary.category} is trending (${countLabel})${employerLabel}`;
  }
  if (roles.length) {
    return `${roleLabelFromTitles(roles)} — ${totalLiveListings.toLocaleString()} live listings across trending categories`;
  }
  return `${totalLiveListings.toLocaleString()} live listings across trending job categories`;
}

async function loadTargetRoles(userId: string): Promise<string[]> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { targetRoles: true },
  });
  return (profile?.targetRoles ?? []).map((r) => r.trim()).filter(Boolean);
}

export async function getDataNestDashboardBundle(input: {
  userId: string;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<DataNestDashboardBundle> {
  const configured = isDatanestConfigured();
  const targetRoles = await loadTargetRoles(input.userId);
  const titles = defaultTitles(targetRoles);
  const roleLabel = roleLabelFromTitles(titles);

  const empty: DataNestDashboardBundle = {
    configured,
    targetRoles: titles,
    roleLabel,
    headline: "",
    trending: [],
    matchedCategories: [],
    topEmployers: [],
    totalLiveListings: 0,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured ? true : undefined,
  };

  if (!configured) {
    return {
      ...empty,
      requiresLoad: undefined,
      error: "DataNest is not configured on this environment (set DATANEST_RAPIDAPI_KEY).",
    };
  }

  const cacheKey = insightsCacheKey("datanest-dashboard", { roles: titles });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<DataNestDashboardBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    const response = await fetchDatanestTrending();
    const trending = (response.data ?? []).map(mapCategory).filter((c) => !c.error || c.topJobs.length > 0);
    const matchedCategories = matchCategoriesForRoles(trending, titles);
    const topEmployers = buildTopEmployers(trending);
    const totalLiveListings = trending.reduce((sum, c) => sum + (c.liveListingCount ?? 0), 0);
    const headline = buildHeadline(matchedCategories, titles, totalLiveListings);

    const bundle: DataNestDashboardBundle = {
      configured: true,
      targetRoles: titles,
      roleLabel,
      headline,
      trending,
      matchedCategories,
      topEmployers,
      totalLiveListings,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      requiresLoad: false,
    };

    setInsightsCached(cacheKey, bundle, TTL_MS);
    return bundle;
  } catch (err) {
    const message = err instanceof Error ? err.message : "DataNest job intelligence failed.";
    const bundle: DataNestDashboardBundle = { ...empty, error: message };
    setInsightsCached(cacheKey, bundle, ERROR_TTL_MS);
    return bundle;
  }
}
