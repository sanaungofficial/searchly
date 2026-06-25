import { prisma } from "@/lib/prisma";
import { hostnameFromUrl } from "@/lib/company-domain";
import {
  fetchSumbleOrganization,
  fetchSumbleOrganizationMatch,
  fetchSumbleOrganizationSignals,
  fetchSumblePeopleAtOrganization,
  fetchSumbleTeamsAtOrganization,
  fetchSumbleIntelligenceBrief,
  fetchSumbleTechnologiesFind,
  lookupSumbleJobFunctionTerms,
  isSumbleConfigured,
  sumbleJobFunctionTerm,
  type SumbleEntityResult,
  type SumbleIntelligenceBrief,
  type SumbleOrganizationAttributes,
  type SumblePersonRow,
  type SumbleSignal,
  type SumbleTeamRow,
  type SumbleTechnologyHit,
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

async function resolveJobFunctionTerms(roles: string[], useLookup: boolean): Promise<string[]> {
  if (!useLookup || !roles.length) return jobFunctionTermsFromRoles(roles.length ? roles : ["Product Manager"]);
  try {
    const lookup = await lookupSumbleJobFunctionTerms(roles);
    return lookup.terms;
  } catch {
    return jobFunctionTermsFromRoles(roles);
  }
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
  const jobFunctionTerms = await resolveJobFunctionTerms(
    targetRoles.length ? targetRoles : ["Product Manager"],
    input.allowFetch === true
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

export type DashboardTrackedCompanySignals = {
  trackedId: string;
  companyName: string;
  domain: string | null;
  organizationId: number | null;
  sumbleUrl: string | null;
  matched: boolean;
  matchError?: string;
  signals: SumbleSignal[];
};

export type DashboardSumbleSignalsBundle = {
  configured: boolean;
  companies: DashboardTrackedCompanySignals[];
  signals: Array<
    SumbleSignal & {
      companyName: string;
      companyDomain: string | null;
      trackedId: string;
      organizationId: number | null;
    }
  >;
  companiesScanned: number;
  companiesMatched: number;
  companiesWithSignals: number;
  totalSignals: number;
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
const DASHBOARD_MAX_COMPANIES = 10;
const DASHBOARD_CREDITS_PER_COMPANY = 4;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function getDashboardSumbleSignalsBundle(input: {
  userId: string;
  forceRefresh?: boolean;
  /** When false, only return server cache — never call Sumble */
  allowFetch?: boolean;
  maxCompanies?: number;
}): Promise<DashboardSumbleSignalsBundle> {
  const configured = isSumbleConfigured();
  const targetRoles = await loadTargetRoles(input.userId);
  const creditsRemaining = getSumbleCreditsRemaining();
  const maxCompanies = Math.max(1, Math.min(input.maxCompanies ?? DASHBOARD_MAX_COMPANIES, DASHBOARD_MAX_COMPANIES));
  const estimatedCredits = maxCompanies * DASHBOARD_CREDITS_PER_COMPANY;

  const empty: DashboardSumbleSignalsBundle = {
    configured,
    companies: [],
    signals: [],
    companiesScanned: 0,
    companiesMatched: 0,
    companiesWithSignals: 0,
    totalSignals: 0,
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

  const cacheKey = insightsCacheKey("sumble-dashboard-signals-v2", { userId: input.userId, maxCompanies });

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
      take: 50,
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
      .slice(0, maxCompanies);

    if (!ranked.length) {
      const bundle: DashboardSumbleSignalsBundle = {
        ...empty,
        error: "Add tracked companies with websites to see Sumble signals.",
      };
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
      return bundle;
    }

    let creditsUsed = 0;
    let creditsRemainingAfter: number | null = null;
    const companies: DashboardTrackedCompanySignals[] = [];
    const aggregated: DashboardSumbleSignalsBundle["signals"] = [];

    for (const company of ranked) {
      const match = await fetchSumbleOrganizationMatch({
        domain: company.domain,
        name: company.companyName,
      });
      creditsUsed += match.creditsUsed;
      creditsRemainingAfter = match.creditsRemaining ?? creditsRemainingAfter;

      if (!match.organizationId) {
        companies.push({
          trackedId: company.trackedId,
          companyName: company.companyName,
          domain: company.domain,
          organizationId: null,
          sumbleUrl: null,
          matched: false,
          matchError: company.domain
            ? `No Sumble match for ${company.domain}`
            : `No Sumble match for ${company.companyName}`,
          signals: [],
        });
        continue;
      }

      const signalsResult = await fetchSumbleOrganizationSignals(match.organizationId);
      creditsUsed += signalsResult.creditsUsed;
      creditsRemainingAfter = signalsResult.creditsRemaining ?? creditsRemainingAfter;

      const orgName = match.organizationName ?? company.companyName;
      companies.push({
        trackedId: company.trackedId,
        companyName: orgName,
        domain: company.domain,
        organizationId: match.organizationId,
        sumbleUrl: match.sumbleUrl,
        matched: true,
        signals: signalsResult.signals,
      });

      for (const signal of signalsResult.signals) {
        aggregated.push({
          ...signal,
          companyName: orgName,
          companyDomain: company.domain,
          trackedId: company.trackedId,
          organizationId: match.organizationId,
        });
      }
    }

    aggregated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const companiesMatched = companies.filter((c) => c.matched).length;
    const companiesWithSignals = companies.filter((c) => c.signals.length > 0).length;

    const bundle: DashboardSumbleSignalsBundle = {
      configured: true,
      companies,
      signals: aggregated,
      companiesScanned: ranked.length,
      companiesMatched,
      companiesWithSignals,
      totalSignals: aggregated.length,
      targetRoles,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      creditsUsed,
      creditsRemaining: creditsRemainingAfter,
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

export type CompanySumbleBriefBundle = {
  configured: boolean;
  companyName: string;
  organizationId: number | null;
  brief: SumbleIntelligenceBrief | null;
  pending: boolean;
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getCompanySumbleBriefBundle(input: {
  userId: string;
  companyName: string;
  website?: string | null;
  careersUrl?: string | null;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<CompanySumbleBriefBundle> {
  const configured = isSumbleConfigured();
  const companyName = input.companyName.trim();
  const domain = resolveDomain(input);
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.intelligenceBrief;

  const empty: CompanySumbleBriefBundle = {
    configured,
    companyName,
    organizationId: null,
    brief: null,
    pending: false,
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

  const cacheKey = insightsCacheKey("sumble-intel-brief", { companyName, domain });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<CompanySumbleBriefBundle>(cacheKey);
    if (hit?.brief) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);

    const match = await fetchSumbleOrganizationMatch({ domain, name: companyName });
    if (!match.organizationId) {
      const bundle: CompanySumbleBriefBundle = {
        ...empty,
        creditsUsed: match.creditsUsed,
        creditsRemaining: match.creditsRemaining,
        requiresLoad: false,
        error: "Could not match this company in Sumble.",
      };
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
      return bundle;
    }

    const briefResult = await fetchSumbleIntelligenceBrief(match.organizationId);

    const bundle: CompanySumbleBriefBundle = {
      configured: true,
      companyName: match.organizationName ?? companyName,
      organizationId: match.organizationId,
      brief: briefResult.brief,
      pending: briefResult.pending,
      creditsUsed: match.creditsUsed + briefResult.creditsUsed,
      creditsRemaining: briefResult.creditsRemaining ?? match.creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      requiresLoad: false,
      estimatedCredits,
      error: briefResult.pending ? briefResult.message : undefined,
    };

    if (briefResult.brief) {
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_TTL_MS);
    }
    return bundle;
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Intelligence brief failed.";
    return {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}

export type CompanySumbleTechBundle = {
  configured: boolean;
  query: string;
  technologies: SumbleTechnologyHit[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getCompanySumbleTechBundle(input: {
  query: string;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<CompanySumbleTechBundle> {
  const configured = isSumbleConfigured();
  const query = input.query.trim();
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = 1;

  const empty: CompanySumbleTechBundle = {
    configured,
    query,
    technologies: [],
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

  if (!query) {
    return { ...empty, error: "Search query is required." };
  }

  const cacheKey = insightsCacheKey("sumble-tech-find", { query: query.toLowerCase() });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<CompanySumbleTechBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const result = await fetchSumbleTechnologiesFind(query);

    const bundle: CompanySumbleTechBundle = {
      configured: true,
      query,
      technologies: result.technologies.slice(0, 10),
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
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
          : "Technology search failed.";
    return {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}
