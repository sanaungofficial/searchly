import { prisma } from "@/lib/prisma";
import { hostnameFromUrl } from "@/lib/company-domain";
import {
  fetchSumbleOrganization,
  fetchSumbleOrganizationSignals,
  fetchSumblePeopleAtOrganization,
  isSumbleConfigured,
  sumbleJobFunctionTerm,
  type SumbleEntityResult,
  type SumbleOrganizationAttributes,
  type SumblePersonRow,
  type SumbleSignal,
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
  targetRoles: string[];
  jobFunctionTerms: string[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  sumbleUrl: string | null;
  peopleSourceUrl: string | null;
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
    targetRoles,
    jobFunctionTerms,
    creditsUsed: 0,
    creditsRemaining: null,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    sumbleUrl: null,
    peopleSourceUrl: null,
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

    const [signalsResult, peopleResult] = await Promise.all([
      fetchSumbleOrganizationSignals(organization.id),
      input.includePeople === false
        ? Promise.resolve({
            people: [],
            total: 0,
            creditsUsed: 0,
            creditsRemaining,
            sourceDataUrl: null,
          })
        : fetchSumblePeopleAtOrganization({ organizationId: organization.id, limit: 5 }),
    ]);

    creditsUsed += signalsResult.creditsUsed + peopleResult.creditsUsed;
    creditsRemaining = peopleResult.creditsRemaining ?? signalsResult.creditsRemaining ?? creditsRemaining;

    const bundle: CompanySumbleIntelBundle = {
      configured: true,
      companyName: organization.name ?? companyName,
      domain,
      organization,
      roleMetrics,
      signals: signalsResult.signals.slice(0, 12),
      people: peopleResult.people,
      peopleTotal: peopleResult.total,
      targetRoles,
      jobFunctionTerms,
      creditsUsed,
      creditsRemaining,
      generatedAt: new Date().toISOString(),
      serverCached: false,
      sumbleUrl: organization.sumble_url ?? null,
      peopleSourceUrl: peopleResult.sourceDataUrl,
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
