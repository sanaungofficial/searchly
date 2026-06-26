import { roleSearchKeywords } from "@/lib/job-match";
import {
  fetchHirebaseJobsSearch,
  fetchHirebaseSummarySearch,
  isHirebaseConfigured,
  type HirebaseJob,
} from "@/lib/hirebase";

export type RoleTitleSuggestion = {
  title: string;
  /** Approximate posting count in the sample (for UI ordering). */
  sampleCount: number;
};

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function titleMatchesQuery(title: string, query: string): boolean {
  const hay = title.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (hay.includes(needle)) return true;
  return needle.split(/\s+/).every((word) => word.length < 2 || hay.includes(word));
}

function collectTitlesFromJobs(jobs: HirebaseJob[], query: string): Map<string, RoleTitleSuggestion> {
  const byKey = new Map<string, RoleTitleSuggestion>();
  for (const job of jobs) {
    const title = normalizeTitle(job.job_title ?? job.title ?? "");
    if (!title || !titleMatchesQuery(title, query)) continue;
    const key = title.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.sampleCount += 1;
      continue;
    }
    byKey.set(key, { title, sampleCount: 1 });
  }
  return byKey;
}

/** Discover real job titles from Hirebase keyword/title search. */
export async function searchHirebaseRoleTitles(input: {
  query: string;
  limit?: number;
  userId?: string | null;
}): Promise<RoleTitleSuggestion[]> {
  if (!isHirebaseConfigured()) return [];

  const query = input.query.trim();
  if (query.length < 2) return [];

  const limit = Math.max(1, Math.min(input.limit ?? 20, 30));
  const keywords = roleSearchKeywords([query]);

  const body: Record<string, unknown> = {
    keywords,
    job_titles: [query],
    page: 1,
    limit: 60,
    sort_by: "date_posted",
    sort_order: "desc",
  };

  let jobs: HirebaseJob[] = [];
  try {
    const data = await fetchHirebaseJobsSearch(body, { userId: input.userId });
    jobs = data.jobs ?? [];
  } catch {
    return [];
  }

  const collected = collectTitlesFromJobs(jobs, query);
  if (query.length >= 3 && !collected.has(query.toLowerCase())) {
    collected.set(query.toLowerCase(), { title: query, sampleCount: 0 });
  }

  return [...collected.values()]
    .sort((a, b) => b.sampleCount - a.sampleCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Expand a seed title using Hirebase semantic search + title search. */
export async function expandHirebaseRelatedRoleTitles(input: {
  seedTitle: string;
  limit?: number;
  userId?: string | null;
}): Promise<RoleTitleSuggestion[]> {
  if (!isHirebaseConfigured()) return [];

  const seedTitle = normalizeTitle(input.seedTitle);
  if (seedTitle.length < 2) return [];

  const limit = Math.max(1, Math.min(input.limit ?? 12, 20));
  const merged = new Map<string, RoleTitleSuggestion>();
  merged.set(seedTitle.toLowerCase(), { title: seedTitle, sampleCount: 999 });

  const semanticQuery = `Job titles similar to "${seedTitle}" and related roles in the same career family`;

  try {
    const summary = await fetchHirebaseSummarySearch({
      query: semanticQuery,
      filters: { limit: 40, jobTitles: [seedTitle], topK: 40 },
    });
    for (const suggestion of collectTitlesFromJobs(summary.rawJobs, seedTitle).values()) {
      const key = suggestion.title.toLowerCase();
      const existing = merged.get(key);
      if (existing) existing.sampleCount += suggestion.sampleCount;
      else merged.set(key, suggestion);
    }
  } catch {
    /* semantic expansion is best-effort */
  }

  try {
    const titleSearch = await searchHirebaseRoleTitles({
      query: seedTitle,
      limit: 20,
      userId: input.userId,
    });
    for (const suggestion of titleSearch) {
      const key = suggestion.title.toLowerCase();
      const existing = merged.get(key);
      if (existing) existing.sampleCount = Math.max(existing.sampleCount, suggestion.sampleCount);
      else merged.set(key, suggestion);
    }
  } catch {
    /* title search is best-effort */
  }

  return [...merged.values()]
    .filter((s) => s.title.toLowerCase() !== seedTitle.toLowerCase() || merged.size === 1)
    .sort((a, b) => b.sampleCount - a.sampleCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}

let cachedCategories: { at: number; values: string[] } | null = null;
const CATEGORY_CACHE_MS = 1000 * 60 * 60 * 6;

/** Aggregate Hirebase job category labels from recent indexed jobs. */
export async function fetchHirebaseJobCategories(userId?: string | null): Promise<string[]> {
  if (!isHirebaseConfigured()) return FALLBACK_JOB_CATEGORIES;

  const now = Date.now();
  if (cachedCategories && now - cachedCategories.at < CATEGORY_CACHE_MS) {
    return cachedCategories.values;
  }

  const body = {
    page: 1,
    limit: 100,
    sort_by: "date_posted",
    sort_order: "desc",
  };

  const counts = new Map<string, number>();
  try {
    const data = await fetchHirebaseJobsSearch(body, { userId });
    for (const job of data.jobs ?? []) {
      for (const cat of job.job_categories ?? []) {
        const label = cat.trim();
        if (!label) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  } catch {
    return FALLBACK_JOB_CATEGORIES;
  }

  const values = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);

  const merged = [...new Set([...values, ...FALLBACK_JOB_CATEGORIES])];
  cachedCategories = { at: now, values: merged };
  return merged;
}

/** Fallback when Hirebase is unavailable or returns sparse category data. */
export const FALLBACK_JOB_CATEGORIES: string[] = [
  "Sales Jobs",
  "Product Jobs",
  "Engineering Jobs",
  "Operations Jobs",
  "Marketing Jobs",
  "Finance Jobs",
  "Human Resources Jobs",
  "Customer Success Jobs",
  "Business Development Jobs",
  "Data Jobs",
  "Design Jobs",
  "Legal Jobs",
  "Administrative Jobs",
  "Consulting Jobs",
  "Project Management Jobs",
];
