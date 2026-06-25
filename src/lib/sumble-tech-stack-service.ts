import { prisma } from "@/lib/prisma";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";
import {
  fetchSumbleTechnologiesLookup,
  fetchSumbleOrganizationsByTechnologies,
  fetchSumbleOrganizationTechnologyEnrich,
  isSumbleConfigured,
  type SumbleTechStackOrganization,
  type SumbleOrganizationTechMatch,
} from "@/lib/sumble";
import {
  assertSumbleCreditsAvailable,
  getSumbleCreditsRemaining,
  SUMBLE_ESTIMATED_COSTS,
  SumbleInsufficientCreditsError,
} from "@/lib/sumble-credits";
import {
  normalizeParsedResumeData,
  type SumbleResolvedTechnology,
} from "@/lib/resume-parse";

const TTL_MS = 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;

function skillsFingerprint(skills: string[]): string {
  return skills
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

async function loadUserSkills(userId: string): Promise<string[]> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { parsedData: true },
  });
  const parsed = normalizeParsedResumeData(profile?.parsedData ?? null);
  return parsed?.skills ?? [];
}

function resolvedFromLookup(
  results: Awaited<ReturnType<typeof fetchSumbleTechnologiesLookup>>["results"]
): SumbleResolvedTechnology[] {
  return results
    .map((row) => {
      if (!row.technology) return null;
      return {
        input: row.input,
        slug: row.technology.slug,
        name: row.technology.name,
      };
    })
    .filter((row): row is SumbleResolvedTechnology => row !== null);
}

export type TechLookupBundle = {
  configured: boolean;
  skills: string[];
  resolved: SumbleResolvedTechnology[];
  unmatched: string[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getTechLookupBundle(input: {
  userId: string;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<TechLookupBundle> {
  const configured = isSumbleConfigured();
  const skills = await loadUserSkills(input.userId);
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.techLookup;

  const empty: TechLookupBundle = {
    configured,
    skills,
    resolved: [],
    unmatched: skills,
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

  if (!skills.length) {
    return { ...empty, requiresLoad: undefined, error: "Add skills to your profile first." };
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: input.userId },
    select: { parsedData: true },
  });
  const parsed = normalizeParsedResumeData(profile?.parsedData ?? null);
  const stored = parsed?.sumbleTechnologies ?? [];
  const storedFp = skillsFingerprint(stored.map((t) => t.input));
  const currentFp = skillsFingerprint(skills);

  if (!input.forceRefresh && stored.length && storedFp === currentFp) {
    const unmatched = skills.filter(
      (skill) => !stored.some((t) => t.input.toLowerCase() === skill.toLowerCase())
    );
    return {
      configured: true,
      skills,
      resolved: stored,
      unmatched,
      creditsUsed: 0,
      creditsRemaining,
      generatedAt: parsed?.sumbleTechnologiesResolvedAt ?? new Date().toISOString(),
      serverCached: true,
      requiresLoad: false,
    };
  }

  const cacheKey = insightsCacheKey("sumble-tech-lookup", { userId: input.userId, fp: currentFp });
  if (!input.forceRefresh) {
    const hit = getInsightsCached<TechLookupBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const result = await fetchSumbleTechnologiesLookup(skills);
    const resolved = resolvedFromLookup(result.results);
    const unmatched = result.results.filter((r) => !r.technology).map((r) => r.input);
    const generatedAt = new Date().toISOString();

    const bundle: TechLookupBundle = {
      configured: true,
      skills,
      resolved,
      unmatched,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      generatedAt,
      serverCached: false,
      requiresLoad: false,
      estimatedCredits,
    };

    setInsightsCached(cacheKey, bundle, TTL_MS);

    if (parsed) {
      await prisma.profile.update({
        where: { userId: input.userId },
        data: {
          parsedData: {
            ...parsed,
            sumbleTechnologies: resolved,
            sumbleTechnologiesResolvedAt: generatedAt,
          },
        },
      });
    }

    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Technology lookup failed.";
    return {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}

export type CompaniesByTechStackBundle = {
  configured: boolean;
  skills: string[];
  resolved: SumbleResolvedTechnology[];
  organizations: SumbleTechStackOrganization[];
  total: number;
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  requiresLookup?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getCompaniesByTechStackBundle(input: {
  userId: string;
  limit?: number;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<CompaniesByTechStackBundle> {
  const configured = isSumbleConfigured();
  const limit = Math.max(1, Math.min(input.limit ?? 10, 20));
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = limit * SUMBLE_ESTIMATED_COSTS.orgByTechStack;

  const lookup = await getTechLookupBundle({
    userId: input.userId,
    allowFetch: false,
    forceRefresh: false,
  });

  const empty: CompaniesByTechStackBundle = {
    configured,
    skills: lookup.skills,
    resolved: lookup.resolved,
    organizations: [],
    total: 0,
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured ? true : undefined,
    requiresLookup: lookup.resolved.length === 0 && !lookup.error,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured." };
  }

  if (!lookup.skills.length) {
    return { ...empty, requiresLoad: undefined, error: "Add skills to your profile first." };
  }

  if (!lookup.resolved.length) {
    return {
      ...empty,
      requiresLoad: undefined,
      requiresLookup: true,
      error: lookup.error ?? "Resolve your technologies first (~1 credit).",
    };
  }

  const slugs = lookup.resolved.map((t) => t.slug);
  const cacheKey = insightsCacheKey("sumble-tech-companies", {
    userId: input.userId,
    slugs,
    limit,
  });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<CompaniesByTechStackBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false, requiresLookup: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const result = await fetchSumbleOrganizationsByTechnologies({
      technologySlugs: slugs,
      limit,
    });

    const bundle: CompaniesByTechStackBundle = {
      configured: true,
      skills: lookup.skills,
      resolved: lookup.resolved,
      organizations: result.organizations,
      total: result.total,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      requiresLoad: false,
      requiresLookup: false,
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
          : "Company search failed.";
    return {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}

export type OrganizationTechEnrichBundle = {
  configured: boolean;
  organizationId: number;
  organizationName: string | null;
  technologies: SumbleOrganizationTechMatch[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getOrganizationTechEnrichBundle(input: {
  userId: string;
  organizationId: number;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<OrganizationTechEnrichBundle> {
  const configured = isSumbleConfigured();
  const creditsRemaining = getSumbleCreditsRemaining();
  const lookup = await getTechLookupBundle({ userId: input.userId, allowFetch: false });
  const slugs = lookup.resolved.map((t) => t.slug);
  const slugToName = new Map(lookup.resolved.map((t) => [t.slug, t.name]));
  const estimatedCredits = slugs.length * SUMBLE_ESTIMATED_COSTS.orgTechEnrich;

  const empty: OrganizationTechEnrichBundle = {
    configured,
    organizationId: input.organizationId,
    organizationName: null,
    technologies: [],
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured && slugs.length ? true : undefined,
    estimatedCredits: configured && slugs.length ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured." };
  }

  if (!slugs.length) {
    return { ...empty, requiresLoad: undefined, error: "Resolve your profile technologies first." };
  }

  const cacheKey = insightsCacheKey("sumble-org-tech-enrich", {
    userId: input.userId,
    orgId: input.organizationId,
    slugs,
  });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<OrganizationTechEnrichBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(Math.min(estimatedCredits, 25));
    const result = await fetchSumbleOrganizationTechnologyEnrich({
      organizationId: input.organizationId,
      technologySlugs: slugs,
    });

    const technologies = result.technologies.map((t) => ({
      ...t,
      name: slugToName.get(t.slug) ?? t.name,
    }));

    const bundle: OrganizationTechEnrichBundle = {
      configured: true,
      organizationId: input.organizationId,
      organizationName: result.organizationName,
      technologies,
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
          : "Technology enrich failed.";
    const errorBundle = { ...empty, error: message };
    setInsightsCached(cacheKey, errorBundle, ERROR_TTL_MS);
    return {
      ...errorBundle,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}
