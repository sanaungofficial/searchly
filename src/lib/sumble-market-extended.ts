import { prisma } from "@/lib/prisma";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";
import {
  fetchSumbleGrowingEmployers,
  fetchSumbleProjectsFromJobs,
  fetchSumbleSignalsSearch,
  isSumbleConfigured,
  lookupSumbleJobFunctionTerms,
  sumbleJobFunctionTerm,
  type SumbleSignal,
} from "@/lib/sumble";
import {
  assertSumbleCreditsAvailable,
  getSumbleCreditsRemaining,
  SUMBLE_ESTIMATED_COSTS,
  SumbleInsufficientCreditsError,
} from "@/lib/sumble-credits";

const TTL_MS = 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;

async function loadTargetRoles(userId: string): Promise<string[]> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { targetRoles: true },
  });
  return (profile?.targetRoles ?? []).map((r) => r.trim()).filter(Boolean);
}

async function resolveJobFunctionTerms(userId: string, allowLookup: boolean): Promise<string[]> {
  const roles = await loadTargetRoles(userId);
  const titles = roles.length ? roles : ["Product Manager"];
  if (!allowLookup) {
    return [...new Set(titles.map(sumbleJobFunctionTerm))].slice(0, 3);
  }
  try {
    const lookup = await lookupSumbleJobFunctionTerms(titles);
    return lookup.terms;
  } catch {
    return [...new Set(titles.map(sumbleJobFunctionTerm))].slice(0, 3);
  }
}

export type MarketSignalsBundle = {
  configured: boolean;
  signals: SumbleSignal[];
  jobFunctionTerms: string[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getMarketSignalsBundle(input: {
  userId: string;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<MarketSignalsBundle> {
  const configured = isSumbleConfigured();
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.marketSignals;

  const empty: MarketSignalsBundle = {
    configured,
    signals: [],
    jobFunctionTerms: [],
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured ? true : undefined,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured." };
  }

  const cacheKey = insightsCacheKey("sumble-market-signals", { userId: input.userId });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<MarketSignalsBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    const terms = await resolveJobFunctionTerms(input.userId, false);
    return { ...empty, jobFunctionTerms: terms };
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const jobFunctionTerms = await resolveJobFunctionTerms(input.userId, true);
    const result = await fetchSumbleSignalsSearch({ jobFunctionTerms, limit: 8 });

    const bundle: MarketSignalsBundle = {
      configured: true,
      signals: result.signals,
      jobFunctionTerms,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      requiresLoad: false,
      estimatedCredits,
    };

    setInsightsCached(cacheKey, bundle, TTL_MS);
    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Market signals failed.";
    const bundle: MarketSignalsBundle = {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
    setInsightsCached(cacheKey, bundle, ERROR_TTL_MS);
    return bundle;
  }
}

export type MarketProjectsBundle = {
  configured: boolean;
  projects: Array<{ name: string; slug: string; goal: string | null; jobCount: number }>;
  jobFunctionTerm: string;
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getMarketProjectsBundle(input: {
  userId: string;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<MarketProjectsBundle> {
  const configured = isSumbleConfigured();
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.marketProjects;

  const empty: MarketProjectsBundle = {
    configured,
    projects: [],
    jobFunctionTerm: "Product Management",
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured ? true : undefined,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured." };
  }

  const cacheKey = insightsCacheKey("sumble-market-projects", { userId: input.userId });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<MarketProjectsBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const terms = await resolveJobFunctionTerms(input.userId, true);
    const primaryTerm = terms[0] ?? "Product Management";
    const result = await fetchSumbleProjectsFromJobs({ jobFunctionTerm: primaryTerm, limit: 15 });

    const bundle: MarketProjectsBundle = {
      configured: true,
      projects: result.projects,
      jobFunctionTerm: primaryTerm,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      requiresLoad: false,
      estimatedCredits,
    };

    setInsightsCached(cacheKey, bundle, TTL_MS);
    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Market projects failed.";
    const bundle: MarketProjectsBundle = {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
    setInsightsCached(cacheKey, bundle, ERROR_TTL_MS);
    return bundle;
  }
}

export type GrowingEmployersBundle = {
  configured: boolean;
  organizations: Array<{
    name: string;
    domain: string | null;
    jobPostCount: number;
    growth1y: number | null;
    sumbleUrl: string | null;
  }>;
  jobFunctionTerm: string;
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getGrowingEmployersBundle(input: {
  userId: string;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<GrowingEmployersBundle> {
  const configured = isSumbleConfigured();
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.growingEmployers;

  const empty: GrowingEmployersBundle = {
    configured,
    organizations: [],
    jobFunctionTerm: "Product Management",
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured ? true : undefined,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured." };
  }

  const cacheKey = insightsCacheKey("sumble-growing-employers", { userId: input.userId });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<GrowingEmployersBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const terms = await resolveJobFunctionTerms(input.userId, true);
    const primaryTerm = terms[0] ?? "Product Management";
    const result = await fetchSumbleGrowingEmployers({ jobFunctionTerm: primaryTerm, limit: 12 });

    const bundle: GrowingEmployersBundle = {
      configured: true,
      organizations: result.organizations,
      jobFunctionTerm: primaryTerm,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      requiresLoad: false,
      estimatedCredits,
    };

    setInsightsCached(cacheKey, bundle, TTL_MS);
    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Growing employers lookup failed.";
    const bundle: GrowingEmployersBundle = {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
    setInsightsCached(cacheKey, bundle, ERROR_TTL_MS);
    return bundle;
  }
}
