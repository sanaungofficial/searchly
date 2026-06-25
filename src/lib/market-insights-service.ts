import { prisma } from "@/lib/prisma";
import {
  buildMarketHeadline,
  fetchHirebaseCompanyInsights,
  fetchHirebaseMarketInsights,
  type HirebaseInsightsResponse,
  type MarketInsightsFilters,
} from "@/lib/hirebase-insights";
import {
  getInsightsCached,
  insightsCacheKey,
  INSIGHTS_CACHE_TTL_MS,
  setInsightsCached,
} from "@/lib/insights-cache";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { resolveHirebaseCompanySlug } from "@/lib/hirebase";
import { getHirebaseMetaFromEnrichment } from "@/lib/hirebase-company-sync";

export const MARKET_WINDOW_OPTIONS = [7, 30, 90, 180] as const;
export type MarketWindow = (typeof MARKET_WINDOW_OPTIONS)[number];

export type MarketInsightsBundle = {
  configured: boolean;
  targetRoles: string[];
  roleLabel: string;
  windows: Record<string, HirebaseInsightsResponse>;
  primaryDays: number;
  headline: string;
  generatedAt: string | null;
  hirebaseCached: boolean;
  serverCached: boolean;
  error?: string;
};

export type CompanyIntelBundle = {
  configured: boolean;
  companyName: string;
  companySlug: string;
  targetRoles: string[];
  windows: Record<string, HirebaseInsightsResponse>;
  primaryDays: number;
  generatedAt: string | null;
  hirebaseCached: boolean;
  serverCached: boolean;
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

async function loadTargetRoles(userId: string): Promise<string[]> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { targetRoles: true },
  });
  return (profile?.targetRoles ?? []).map((r) => r.trim()).filter(Boolean);
}

async function fetchWindowInsights(
  filters: MarketInsightsFilters,
  forceRefresh: boolean
): Promise<{ data: HirebaseInsightsResponse; serverCached: boolean }> {
  const key = insightsCacheKey("market", filters);
  if (!forceRefresh) {
    const hit = getInsightsCached<HirebaseInsightsResponse>(key);
    if (hit) return { data: hit, serverCached: true };
  }

  const data = await fetchHirebaseMarketInsights(filters);
  setInsightsCached(key, data, INSIGHTS_CACHE_TTL_MS);
  return { data, serverCached: false };
}

export async function getMarketInsightsBundle(input: {
  userId: string;
  primaryDays?: number;
  compareWindows?: number[];
  forceRefresh?: boolean;
}): Promise<MarketInsightsBundle> {
  const configured = isHirebaseConfigured();
  const targetRoles = await loadTargetRoles(input.userId);
  const titles = defaultTitles(targetRoles);
  const roleLabel = roleLabelFromTitles(titles);
  const primaryDays = input.primaryDays ?? 30;
  const compareWindows = input.compareWindows ?? [7, 30, 90];
  const windowsToFetch = [...new Set([primaryDays, ...compareWindows])].sort((a, b) => a - b);

  if (!configured) {
    return {
      configured: false,
      targetRoles: titles,
      roleLabel,
      windows: {},
      primaryDays,
      headline: "",
      generatedAt: null,
      hirebaseCached: false,
      serverCached: false,
      error: "Hirebase is not configured on this environment.",
    };
  }

  try {
    const windows: Record<string, HirebaseInsightsResponse> = {};
    let anyServerCached = true;
    let hirebaseCached = false;

    await Promise.all(
      windowsToFetch.map(async (days) => {
        const filters: MarketInsightsFilters = {
          job_titles: titles,
          days_ago: days,
        };
        const { data, serverCached } = await fetchWindowInsights(filters, input.forceRefresh ?? false);
        windows[String(days)] = data;
        if (!serverCached) anyServerCached = false;
        if (data.cached) hirebaseCached = true;
      })
    );

    const primary = windows[String(primaryDays)] ?? windows[String(windowsToFetch[0])];
    const generatedAt = primary?.generated_at ?? null;

    return {
      configured: true,
      targetRoles: titles,
      roleLabel,
      windows,
      primaryDays,
      headline: primary ? buildMarketHeadline(primary, roleLabel, primaryDays) : "",
      generatedAt,
      hirebaseCached,
      serverCached: anyServerCached,
    };
  } catch (err) {
    return {
      configured: true,
      targetRoles: titles,
      roleLabel,
      windows: {},
      primaryDays,
      headline: "",
      generatedAt: null,
      hirebaseCached: false,
      serverCached: false,
      error: err instanceof Error ? err.message : "Failed to load market insights.",
    };
  }
}

async function resolveSlugForCompany(input: {
  companyName: string;
  slugHint?: string | null;
  website?: string | null;
}): Promise<string | null> {
  if (input.slugHint?.trim()) return input.slugHint.trim();
  try {
    return await resolveHirebaseCompanySlug(input.companyName, input.slugHint);
  } catch {
    return null;
  }
}

export async function getCompanyIntelBundle(input: {
  userId: string;
  companyName: string;
  slugHint?: string | null;
  website?: string | null;
  primaryDays?: number;
  compareWindows?: number[];
  forceRefresh?: boolean;
}): Promise<CompanyIntelBundle> {
  const configured = isHirebaseConfigured();
  const targetRoles = await loadTargetRoles(input.userId);
  const titles = defaultTitles(targetRoles);
  const primaryDays = input.primaryDays ?? 30;
  const compareWindows = input.compareWindows ?? [7, 30, 90];
  const windowsToFetch = [...new Set([primaryDays, ...compareWindows])].sort((a, b) => a - b);

  if (!configured) {
    return {
      configured: false,
      companyName: input.companyName,
      companySlug: "",
      targetRoles: titles,
      windows: {},
      primaryDays,
      generatedAt: null,
      hirebaseCached: false,
      serverCached: false,
      error: "Hirebase is not configured on this environment.",
    };
  }

  const slug =
    (await resolveSlugForCompany(input)) ??
    (input.slugHint?.trim() || null);

  if (!slug) {
    return {
      configured: true,
      companyName: input.companyName,
      companySlug: "",
      targetRoles: titles,
      windows: {},
      primaryDays,
      generatedAt: null,
      hirebaseCached: false,
      serverCached: false,
      error: `No Hirebase profile found for "${input.companyName}".`,
    };
  }

  try {
    const windows: Record<string, HirebaseInsightsResponse> = {};
    let anyServerCached = true;
    let hirebaseCached = false;

    await Promise.all(
      windowsToFetch.map(async (days) => {
        const filters: MarketInsightsFilters = {
          job_titles: titles.length ? titles : undefined,
          days_ago: days,
        };
        const key = insightsCacheKey("company", { slug, ...filters });
        if (!input.forceRefresh) {
          const hit = getInsightsCached<HirebaseInsightsResponse>(key);
          if (hit) {
            windows[String(days)] = hit;
            return;
          }
        }
        const data = await fetchHirebaseCompanyInsights(slug, filters);
        setInsightsCached(key, data, INSIGHTS_CACHE_TTL_MS);
        windows[String(days)] = data;
        anyServerCached = false;
        if (data.cached) hirebaseCached = true;
      })
    );

    const primary = windows[String(primaryDays)] ?? windows[String(windowsToFetch[0])];

    return {
      configured: true,
      companyName: input.companyName,
      companySlug: slug,
      targetRoles: titles,
      windows,
      primaryDays,
      generatedAt: primary?.generated_at ?? null,
      hirebaseCached,
      serverCached: anyServerCached,
    };
  } catch (err) {
    return {
      configured: true,
      companyName: input.companyName,
      companySlug: slug,
      targetRoles: titles,
      windows: {},
      primaryDays,
      generatedAt: null,
      hirebaseCached: false,
      serverCached: false,
      error: err instanceof Error ? err.message : "Failed to load company insights.",
    };
  }
}

/** Resolve Hirebase slug from tracked company enrichment when available. */
export function slugFromEnrichment(raw: unknown): string | null {
  return getHirebaseMetaFromEnrichment(raw)?.slug ?? null;
}
