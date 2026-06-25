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
  forceRefresh?: boolean;
}): Promise<CompanySumbleIntelBundle> {
  const configured = isSumbleConfigured();
  const companyName = input.companyName.trim();
  const domain = resolveDomain(input);
  const targetRoles = await loadTargetRoles(input.userId);
  const jobFunctionTerms = jobFunctionTermsFromRoles(
    targetRoles.length ? targetRoles : ["Product Manager"]
  );

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
    creditsRemaining: null,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    sumbleUrl: null,
    peopleSourceUrl: null,
    teamsSourceUrl: null,
  };

  if (!configured) {
    return {
      ...empty,
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
    includePeople: input.includePeople ?? true,
    includeTeams: input.includeTeams ?? true,
  });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<CompanySumbleIntelBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true };
  }

  try {
    let creditsUsed = 0;
    let creditsRemaining: number | null = null;

    const orgResult = await fetchSumbleOrganization({
      domain,
      name: companyName,
      slug: input.slugHint,
      jobFunctionTerms,
    });
    creditsUsed += orgResult.creditsUsed;
    creditsRemaining = orgResult.creditsRemaining;

    const organization = orgResult.organization?.attributes ?? null;
    const roleMetrics = orgResult.organization?.entities ?? [];

    if (organization?.id == null && !organization?.name?.trim()) {
      const bundle: CompanySumbleIntelBundle = {
        ...empty,
        creditsUsed,
        creditsRemaining,
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
        creditsRemaining,
        companyName: organization?.name ?? companyName,
        sumbleUrl: organization?.sumble_url ?? null,
        error: "Sumble matched this company but could not load detailed intel yet. Try Refresh.",
      };
      setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
      return bundle;
    }

    const includePeople = input.includePeople !== false;
    const includeTeams = input.includeTeams !== false;

    const [signalsResult, peopleResult, teamsResult] = await Promise.all([
      fetchSumbleOrganizationSignals(orgId),
      includePeople
        ? fetchSumblePeopleAtOrganization({
            organizationId: orgId,
            limit: 5,
            jobFunctionTerms,
          })
        : Promise.resolve({
            people: [],
            total: 0,
            creditsUsed: 0,
            creditsRemaining,
            sourceDataUrl: null,
            filteredByRole: false,
          }),
      includeTeams
        ? fetchSumbleTeamsAtOrganization({ organizationId: orgId, limit: 5 })
        : Promise.resolve({
            teams: [],
            total: 0,
            creditsUsed: 0,
            creditsRemaining,
            sourceDataUrl: null,
          }),
    ]);

    creditsUsed += signalsResult.creditsUsed + peopleResult.creditsUsed + teamsResult.creditsUsed;
    creditsRemaining =
      teamsResult.creditsRemaining ??
      peopleResult.creditsRemaining ??
      signalsResult.creditsRemaining ??
      creditsRemaining;

    const bundle: CompanySumbleIntelBundle = {
      configured: true,
      companyName: organization.name ?? companyName,
      domain,
      organization,
      roleMetrics,
      signals: signalsResult.signals.slice(0, 12),
      people: peopleResult.people,
      peopleTotal: peopleResult.total,
      peopleFilteredByRole: peopleResult.filteredByRole,
      teams: teamsResult.teams,
      teamsTotal: teamsResult.total,
      targetRoles,
      jobFunctionTerms,
      creditsUsed,
      creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      sumbleUrl: organization.sumble_url ?? null,
      peopleSourceUrl: peopleResult.sourceDataUrl,
      teamsSourceUrl: teamsResult.sourceDataUrl,
    };

    setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_TTL_MS);
    return bundle;
  } catch (err) {
    const bundle: CompanySumbleIntelBundle = {
      ...empty,
      error: err instanceof Error ? err.message : "Sumble request failed.",
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
  error?: string;
};

const DASHBOARD_SIGNALS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DASHBOARD_MAX_COMPANIES = 6;
const DASHBOARD_SIGNALS_PER_COMPANY = 4;
const DASHBOARD_MAX_SIGNALS = 12;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function getDashboardSumbleSignalsBundle(input: {
  userId: string;
  forceRefresh?: boolean;
}): Promise<DashboardSumbleSignalsBundle> {
  const configured = isSumbleConfigured();
  const targetRoles = await loadTargetRoles(input.userId);

  const empty: DashboardSumbleSignalsBundle = {
    configured,
    signals: [],
    companiesScanned: 0,
    companiesWithSignals: 0,
    targetRoles,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    creditsUsed: 0,
    creditsRemaining: null,
  };

  if (!configured) {
    return { ...empty, error: "Sumble is not configured on this environment." };
  }

  const cacheKey = insightsCacheKey("sumble-dashboard-signals", { userId: input.userId });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<DashboardSumbleSignalsBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true };
  }

  try {
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
    };

    setInsightsCached(cacheKey, bundle, DASHBOARD_SIGNALS_TTL_MS);
    return bundle;
  } catch (err) {
    const bundle: DashboardSumbleSignalsBundle = {
      ...empty,
      error: err instanceof Error ? err.message : "Sumble dashboard signals failed.",
    };
    setInsightsCached(cacheKey, bundle, SUMBLE_INTEL_ERROR_TTL_MS);
    return bundle;
  }
}
