import { hostnameFromUrl } from "@/lib/company-domain";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";
import { prisma } from "@/lib/prisma";
import {
  fetchSumbleJobRelatedPeople,
  fetchSumbleOrganizationMatch,
  fetchSumblePeopleAtOrganization,
  isSumbleConfigured,
  sumbleJobFunctionTerm,
  type SumblePersonRow,
  type SumbleRelatedPersonRow,
} from "@/lib/sumble";
import {
  assertSumbleCreditsAvailable,
  getSumbleCreditsRemaining,
  SUMBLE_ESTIMATED_COSTS,
  SumbleInsufficientCreditsError,
} from "@/lib/sumble-credits";

const TTL_MS = 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;

export type InsiderConnectionPerson = {
  personId: number | null;
  name: string;
  jobTitle: string | null;
  jobLevel: string | null;
  linkedinUrl: string | null;
  sumbleUrl: string | null;
  confidenceScore: number | null;
  bucket: "hiring" | "org" | "alumni";
};

export type JobInsiderConnectionsBundle = {
  configured: boolean;
  companyName: string;
  jobTitle: string;
  domain: string | null;
  organizationId: number | null;
  sumbleJobUrl: string | null;
  hiringManagers: InsiderConnectionPerson[];
  orgPeople: InsiderConnectionPerson[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
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

function mapRelatedPerson(row: SumbleRelatedPersonRow, bucket: InsiderConnectionPerson["bucket"]): InsiderConnectionPerson | null {
  const attrs = row.attributes;
  if (!attrs?.name?.trim()) return null;
  return {
    personId: row.person_id ?? null,
    name: attrs.name.trim(),
    jobTitle: attrs.job_title ?? null,
    jobLevel: attrs.job_level ?? null,
    linkedinUrl: attrs.linkedin_url ?? null,
    sumbleUrl: row.sumble_url ?? null,
    confidenceScore: row.confidence?.score ?? null,
    bucket,
  };
}

function mapPersonRow(row: SumblePersonRow, bucket: InsiderConnectionPerson["bucket"]): InsiderConnectionPerson | null {
  const attrs = row.attributes;
  if (!attrs?.name?.trim()) return null;
  return {
    personId: row.person_id ?? null,
    name: attrs.name.trim(),
    jobTitle: attrs.job_title ?? null,
    jobLevel: attrs.job_level ?? null,
    linkedinUrl: attrs.linkedin_url ?? null,
    sumbleUrl: row.sumble_url ?? null,
    confidenceScore: null,
    bucket,
  };
}

export async function getJobInsiderConnectionsBundle(input: {
  userId: string;
  companyName: string;
  jobTitle: string;
  website?: string | null;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<JobInsiderConnectionsBundle> {
  const configured = isSumbleConfigured();
  const companyName = input.companyName.trim();
  const jobTitle = input.jobTitle.trim();
  const domain = hostnameFromUrl(input.website) ?? input.website?.trim() ?? null;
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.jobContacts;

  const empty: JobInsiderConnectionsBundle = {
    configured,
    companyName,
    jobTitle,
    domain,
    organizationId: null,
    sumbleJobUrl: null,
    hiringManagers: [],
    orgPeople: [],
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
    serverCached: false,
    requiresLoad: configured ? true : undefined,
    estimatedCredits: configured ? estimatedCredits : undefined,
  };

  if (!configured) {
    return { ...empty, requiresLoad: undefined, error: "Sumble is not configured on this environment." };
  }

  if (!companyName) {
    return { ...empty, error: "Company name is required." };
  }

  const cacheKey = insightsCacheKey("sumble-job-contacts", { companyName, jobTitle, domain });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<JobInsiderConnectionsBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);

    const targetRoles = await loadTargetRoles(input.userId);
    const jobFunctionTerms = [
      ...new Set(
        (targetRoles.length ? targetRoles : [jobTitle || "Product Manager"]).map(sumbleJobFunctionTerm)
      ),
    ].slice(0, 2);

    let creditsUsed = 0;
    let creditsRemainingAfter: number | null = creditsRemaining;

    const match = await fetchSumbleOrganizationMatch({ domain, name: companyName });
    creditsUsed += match.creditsUsed;
    creditsRemainingAfter = match.creditsRemaining ?? creditsRemainingAfter;

    if (!match.organizationId) {
      const bundle: JobInsiderConnectionsBundle = {
        ...empty,
        creditsUsed,
        creditsRemaining: creditsRemainingAfter,
        requiresLoad: false,
        error: domain
          ? `No Sumble match for ${domain}. Add a company website to improve matching.`
          : `No Sumble match for ${companyName}.`,
      };
      setInsightsCached(cacheKey, bundle, ERROR_TTL_MS);
      return bundle;
    }

    const hiringResult = jobTitle
      ? await fetchSumbleJobRelatedPeople({
          organizationId: match.organizationId,
          jobTitle,
          relatedPeopleLimit: 5,
        })
      : { job: null, relatedPeople: [], creditsUsed: 0, creditsRemaining: creditsRemainingAfter };

    creditsUsed += hiringResult.creditsUsed;
    creditsRemainingAfter = hiringResult.creditsRemaining ?? creditsRemainingAfter;

    const peopleResult = await fetchSumblePeopleAtOrganization({
      organizationId: match.organizationId,
      limit: 5,
      jobFunctionTerms,
    });
    creditsUsed += peopleResult.creditsUsed;
    creditsRemainingAfter = peopleResult.creditsRemaining ?? creditsRemainingAfter;

    const hiringManagers = hiringResult.relatedPeople
      .map((p) => mapRelatedPerson(p, "hiring"))
      .filter(Boolean) as InsiderConnectionPerson[];

    const orgPeople = peopleResult.people
      .map((p) => mapPersonRow(p, "org"))
      .filter(Boolean) as InsiderConnectionPerson[];

    const bundle: JobInsiderConnectionsBundle = {
      configured: true,
      companyName: match.organizationName ?? companyName,
      jobTitle,
      domain,
      organizationId: match.organizationId,
      sumbleJobUrl: hiringResult.job?.sumble_url ?? null,
      hiringManagers,
      orgPeople,
      creditsUsed,
      creditsRemaining: creditsRemainingAfter,
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
          : "Sumble contact lookup failed.";
    const bundle: JobInsiderConnectionsBundle = {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
    setInsightsCached(cacheKey, bundle, ERROR_TTL_MS);
    return bundle;
  }
}
