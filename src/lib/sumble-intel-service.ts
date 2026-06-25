import { prisma } from "@/lib/prisma";
import { hostnameFromUrl } from "@/lib/company-domain";
import {
  fetchSumbleOrganization,
  fetchSumbleOrganizationMatch,
  fetchSumbleOrganizationSignals,
  fetchSumblePeopleAtOrganization,
  fetchSumbleTeamsAtOrganization,
  isSumbleConfigured,
  sumbleJobFunctionTerm,
  type SumbleEntityResult,
  type SumbleOrganizationAttributes,
  type SumblePersonRow,
  type SumbleSignal,
  type SumbleTeamRow,
} from "@/lib/sumble";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";
import {
  assertSumbleCreditsAvailable,
  getSumbleCreditsRemaining,
  SUMBLE_ESTIMATED_COSTS,
  SumbleInsufficientCreditsError,
} from "@/lib/sumble-credits";

const SUMBLE_INTEL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SUMBLE_INTEL_ERROR_TTL_MS = 5 * 60 * 1000; // 5 minutes — don't stick on bad cache

export type CompanySumbleIntelBundle = {
  configured: boolean;
  companyName: string;
  domain: string | null;
  organization: SumbleOrganizationAttributes | null;
  roleMetrics: SumbleEntityResult[];
  signals: SumbleSignal[];
  people: SumblePersonRow[];
  peopleTotal: number;
  peopleFilteredByRole: boolean;
  teams: SumbleTeamRow[];
  teamsTotal: number;
  targetRoles: string[];
  jobFunctionTerms: string[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  sumbleUrl: string | null;
  peopleSourceUrl: string | null;
  teamsSourceUrl: string | null;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

async function loadTargetRoles(userId: string): Promise<string[]> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { targetRoles: true },
  });
  return (profile?.targetRoles ?? []).map((r) => r.trim()).filter(Boolean);
}

function resolveDomain(input: {
  website?: string | null;
  careersUrl?: string | null;
}): string | null {
  return hostnameFromUrl(input.website) ?? hostnameFromUrl(input.careersUrl);
}

function jobFunctionTermsFromRoles(roles: string[]): string[] {
  const terms = roles.map(sumbleJobFunctionTerm);
  return [...new Set(terms)].slice(0, 3);
}

export async function getCompanySumbleIntelBundle(input: {
  userId: string;
  companyName: string;
  website?: string | null;
  careersUrl?: string | null;
  slugHint?: string | null;
  includePeople?: boolean;
  includeTeams?: boolean;
  includeSignals?: boolean;
  forceRefresh?: boolean;
  /** When false, only return server cache — never call Sumble */
  allowFetch?: boolean;
}): Promise<CompanySumbleIntelBundle> {
  const configured = isSumbleConfigured();
  const companyName = input.companyName.trim();
  const domain = resolveDomain(input);
  const targetRoles = await loadTargetRoles(input.userId);
  const jobFunctionTerms = jobFunctionTermsFromRoles(
    targetRoles.length ? targetRoles : ["Product Manager"]
  );
  const creditsRemaining = getSumbleCreditsRemaining();
  const includePeople = input.includePeople === true;
  const includeTeams = input.includeTeams === true;
  const includeSignals = input.includeSignals !== false;
  const estimatedCredits =
    SUMBLE_ESTIMATED_COSTS.companyLite +
    (includePeople ? 5 : 0) +
    (includeTeams ? 5 : 0);

  const empty: CompanySumbleIntelBundle = {
    configured,
    companyName,
    domain,
    organization: null,
    roleMetrics: [],
    signals: [],
    people: [],
    peopleTotal: 0,
    peopleFilteredByRole: false,
    teams: [],
    teamsTotal: 0,
    targetRoles,
    jobFunctionTerms,
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    sumbleUrl: null,
    peopleSourceUrl: null,
    teamsSourceUrl: null,
    requiresLoad: configured ? true : undefined,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return {
      ...empty,
      requiresLoad: undefined,
      error: "Sumble is not configured on this environment.",
    };
  }

  if (!companyName && !domain && !input.slugHint?.trim()) {
    return { ...empty, error: "Company name or website is required." };
  }

  const cacheKey = insightsCacheKey("sumble-intel", {
    companyName,
    domain,
    slug: input.slugHint ?? null,
    jobFunctionTerms,
    includePeople,
    includeTeams,
    includeSignals,
  });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<CompanySumbleIntelBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);

    let creditsUsed = 0;
    let creditsRemainingAfter: number | null = creditsRemaining;

    const orgResult = await fetchSumbleOrganization({
      domain,
      name: companyName,
      slug: input.slugHint,
      jobFunctionTerms,
      includeRoleMetrics: true,
    });
    creditsUsed += orgResult.creditsUsed;
    creditsRemainingAfter = orgResult.creditsRemaining;

    const organization = orgResult.organization?.attributes ?? null;
    const roleMetrics = orgResult.organization?.entities ?? [];

    if (organization?.id == null && !organization?.name?.trim()) {
      const bundle: CompanySumbleIntelBundle = {
        ...empty,
        creditsUsed,
        creditsRemaining: creditsRemainingAfter,
        requiresLoad: false,
        error: domain
          ? `No Sumble match for ${domain}. Try Refresh after updating the website.`
          : `No Sumble match for ${companyName}. Add a website domain and refresh.`,
      };
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
      return bundle;
    }

    const orgId = organization?.id;
    if (orgId == null) {
      const bundle: CompanySumbleIntelBundle = {
        ...empty,
        organization,
        roleMetrics,
        creditsUsed,
        creditsRemaining: creditsRemainingAfter,
        companyName: organization?.name ?? companyName,
        sumbleUrl: organization?.sumble_url ?? null,
        requiresLoad: false,
        error: "Sumble matched this company but could not load detailed intel yet. Try Refresh.",
      };
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
      return bundle;
    }

    let signalsResult = {
      signals: [] as SumbleSignal[],
      creditsUsed: 0,
      creditsRemaining: creditsRemainingAfter,
    };
    let peopleResult = {
      people: [] as SumblePersonRow[],
      total: 0,
      creditsUsed: 0,
      creditsRemaining: creditsRemainingAfter,
      sourceDataUrl: null as string | null,
      filteredByRole: false,
    };
    let teamsResult = {
      teams: [] as SumbleTeamRow[],
      total: 0,
      creditsUsed: 0,
      creditsRemaining: creditsRemainingAfter,
      sourceDataUrl: null as string | null,
    };

    if (includeSignals) {
      signalsResult = await fetchSumbleOrganizationSignals(orgId);
      creditsUsed += signalsResult.creditsUsed;
      creditsRemainingAfter = signalsResult.creditsRemaining ?? creditsRemainingAfter;
    }

    if (includePeople) {
      peopleResult = await fetchSumblePeopleAtOrganization({
        organizationId: orgId,
        limit: 5,
        jobFunctionTerms,
      });
      creditsUsed += peopleResult.creditsUsed;
      creditsRemainingAfter = peopleResult.creditsRemaining ?? creditsRemainingAfter;
    }

    if (includeTeams) {
      teamsResult = await fetchSumbleTeamsAtOrganization({ organizationId: orgId, limit: 5 });
      creditsUsed += teamsResult.creditsUsed;
      creditsRemainingAfter = teamsResult.creditsRemaining ?? creditsRemainingAfter;
    }

    const bundle: CompanySumbleIntelBundle = {
      configured: true,
      companyName: organization.name ?? companyName,
      domain,
      organization,
      roleMetrics,
      signals: signalsResult.signals.slice(0, 8),
      people: peopleResult.people,
      peopleTotal: peopleResult.total,
      peopleFilteredByRole: peopleResult.filteredByRole,
      teams: teamsResult.teams,
      teamsTotal: teamsResult.total,
      targetRoles,
      jobFunctionTerms,
      creditsUsed,
      creditsRemaining: creditsRemainingAfter,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      sumbleUrl: organization.sumble_url ?? null,
      peopleSourceUrl: peopleResult.sourceDataUrl,
      teamsSourceUrl: teamsResult.sourceDataUrl,
      requiresLoad: false,
      estimatedCredits,
    };

    setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_TTL_MS);
    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Sumble request failed.";
    const bundle: CompanySumbleIntelBundle = {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError
          ? err.creditsRemaining
          : creditsRemaining,
    };
    setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
    return bundle;
  }
}

export type TrackedCompanySignalSource = {
  trackedId: string;
  companyName: string;
  domain: string | null;
  organizationId: number | null;
  sumbleUrl: string | null;
};

export type DashboardSumbleSignalsBundle = {
  configured: boolean;
  signals: Array<
    SumbleSignal & {
      companyName: string;
      companyDomain: string | null;
      trackedId: string;
    }
  >;
  companiesScanned: number;
  companiesWithSignals: number;
  targetRoles: string[];
  generatedAt: string;
  serverCached: boolean;
  creditsUsed: number;
  creditsRemaining: number | null;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

const DASHBOARD_SIGNALS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DASHBOARD_MAX_COMPANIES = 3;
const DASHBOARD_SIGNALS_PER_COMPANY = 3;
const DASHBOARD_MAX_SIGNALS = 8;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function getDashboardSumbleSignalsBundle(input: {
  userId: string;
  forceRefresh?: boolean;
  /** When false, only return server cache — never call Sumble */
  allowFetch?: boolean;
}): Promise<DashboardSumbleSignalsBundle> {
  const configured = isSumbleConfigured();
  const targetRoles = await loadTargetRoles(input.userId);
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.dashboardSignals;

  const empty: DashboardSumbleSignalsBundle = {
    configured,
    signals: [],
    companiesScanned: 0,
    companiesWithSignals: 0,
    targetRoles,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    creditsUsed: 0,
    creditsRemaining,
    requiresLoad: configured ? true : undefined,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured on this environment." };
  }

  const cacheKey = insightsCacheKey("sumble-dashboard-signals", { userId: input.userId });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<DashboardSumbleSignalsBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);

    const tracked = await prisma.trackedCompany.findMany({
      where: { userId: input.userId },
      include: { companyIntel: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });

    const ranked = tracked
      .map((row) => {
        const website = row.website ?? row.companyIntel?.website ?? null;
        const careersUrl = row.careersUrl ?? row.companyIntel?.careersUrl ?? null;
        const domain = resolveDomain({ website, careersUrl });
        const name = row.companyIntel?.name ?? row.name;
        const priority = (row.priority ?? "").trim().toLowerCase();
        return {
          trackedId: row.id,
          companyName: name,
          domain,
          priorityRank: PRIORITY_RANK[priority] ?? 3,
        };
      })
      .filter((row) => row.domain || row.companyName.trim())
      .sort((a, b) => a.priorityRank - b.priorityRank)
      .slice(0, DASHBOARD_MAX_COMPANIES);

    if (!ranked.length) {
      const bundle: DashboardSumbleSignalsBundle = {
        ...empty,
        error: "Add tracked companies with websites to see Sumble signals.",
      };
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
      return bundle;
    }

    let creditsUsed = 0;
    let creditsRemaining: number | null = null;
    const aggregated: DashboardSumbleSignalsBundle["signals"] = [];

    for (const company of ranked) {
      if (aggregated.length >= DASHBOARD_MAX_SIGNALS) break;

      const match = await fetchSumbleOrganizationMatch({
        domain: company.domain,
        name: company.companyName,
      });
      creditsUsed += match.creditsUsed;
      creditsRemaining = match.creditsRemaining ?? creditsRemaining;

      if (!match.organizationId) continue;

      const signalsResult = await fetchSumbleOrganizationSignals(match.organizationId);
      creditsUsed += signalsResult.creditsUsed;
      creditsRemaining = signalsResult.creditsRemaining ?? creditsRemaining;

      for (const signal of signalsResult.signals.slice(0, DASHBOARD_SIGNALS_PER_COMPANY)) {
        aggregated.push({
          ...signal,
          companyName: match.organizationName ?? company.companyName,
          companyDomain: company.domain,
          trackedId: company.trackedId,
        });
        if (aggregated.length >= DASHBOARD_MAX_SIGNALS) break;
      }
    }

    aggregated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const companiesWithSignals = new Set(aggregated.map((s) => s.trackedId)).size;

    const bundle: DashboardSumbleSignalsBundle = {
      configured: true,
      signals: aggregated,
      companiesScanned: ranked.length,
      companiesWithSignals,
      targetRoles,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      creditsUsed,
      creditsRemaining,
      requiresLoad: false,
      estimatedCredits,
    };

    setInsightsCached(cacheKey, bundle, DASHBOARD_SIGNALS_TTL_MS);
    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Sumble dashboard signals failed.";
    const bundle: DashboardSumbleSignalsBundle = {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError
          ? err.creditsRemaining
          : creditsRemaining,
    };
    setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
    return bundle;
  }
}
