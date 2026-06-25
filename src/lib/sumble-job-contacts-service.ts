import { hostnameFromUrl } from "@/lib/company-domain";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";
import {
  fetchSumbleJobRelatedPeople,
  fetchSumbleOrganizationMatch,
  fetchSumblePeopleAtOrganization,
  fetchSumblePersonRelatedNetwork,
  fetchSumbleTeamsForJobFunction,
  isSumbleConfigured,
  lookupSumbleJobFunctionTerms,
  sumbleJobFunctionTerm,
  type SumblePersonRow,
  type SumbleRelatedPersonRow,
  type SumbleTeamRelatedPersonRow,
  type SumbleTitleLookupResult,
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
  jobFunction: string | null;
  linkedinUrl: string | null;
  sumbleUrl: string | null;
  confidenceScore: number | null;
  bucket: "hiring" | "team" | "org" | "alumni" | "manager" | "peer";
};

export type JobHiringTeam = {
  teamId: number | null;
  teamName: string;
  sumbleUrl: string | null;
  jobsCount: number | null;
  people: InsiderConnectionPerson[];
};

export type JobTitleMapping = {
  input: string;
  jobFunction: string | null;
  jobLevel: string | null;
  source: "sumble" | "heuristic";
};

export type JobInsiderConnectionsBundle = {
  configured: boolean;
  companyName: string;
  jobTitle: string;
  domain: string | null;
  organizationId: number | null;
  sumbleJobUrl: string | null;
  titleMapping: JobTitleMapping | null;
  hiringTeams: JobHiringTeam[];
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

function mapRelatedPerson(
  row: SumbleRelatedPersonRow | SumbleTeamRelatedPersonRow,
  bucket: InsiderConnectionPerson["bucket"]
): InsiderConnectionPerson | null {
  const attrs = row.attributes;
  if (!attrs?.name?.trim()) return null;
  return {
    personId: row.person_id ?? null,
    name: attrs.name.trim(),
    jobTitle: attrs.job_title ?? null,
    jobLevel: attrs.job_level ?? null,
    jobFunction: attrs.job_function ?? null,
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
    jobFunction: attrs.job_function ?? null,
    linkedinUrl: attrs.linkedin_url ?? null,
    sumbleUrl: row.sumble_url ?? null,
    confidenceScore: null,
    bucket,
  };
}

function dedupePeople(people: InsiderConnectionPerson[]): InsiderConnectionPerson[] {
  const seen = new Set<string>();
  const out: InsiderConnectionPerson[] = [];
  for (const person of people) {
    const key = person.personId != null ? `id:${person.personId}` : `name:${person.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(person);
  }
  return out;
}

async function resolveTitleMapping(jobTitle: string): Promise<{
  mapping: JobTitleMapping;
  jobFunctionTerms: string[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const input = jobTitle.trim() || "Product Manager";
  const cacheKey = insightsCacheKey("sumble-title-lookup", { title: input.toLowerCase() });
  const cached = getInsightsCached<{
    mapping: JobTitleMapping;
    jobFunctionTerms: string[];
  }>(cacheKey);
  if (cached) {
    return { ...cached, creditsUsed: 0, creditsRemaining: getSumbleCreditsRemaining() };
  }

  let creditsUsed = 0;
  let creditsRemaining: number | null = getSumbleCreditsRemaining();
  let lookupResults: SumbleTitleLookupResult[] = [];

  try {
    const lookup = await lookupSumbleJobFunctionTerms([input]);
    creditsUsed += lookup.creditsUsed;
    creditsRemaining = lookup.creditsRemaining ?? creditsRemaining;
    lookupResults = lookup.results;
  } catch {
    // fall through to heuristic
  }

  const primary = lookupResults[0];
  const jobFunction = primary?.job_function?.trim() || sumbleJobFunctionTerm(input);
  const jobLevel = primary?.job_level?.trim() || null;
  const mapping: JobTitleMapping = {
    input,
    jobFunction,
    jobLevel,
    source: primary?.job_function ? "sumble" : "heuristic",
  };
  const jobFunctionTerms = [jobFunction];

  setInsightsCached(cacheKey, { mapping, jobFunctionTerms }, TTL_MS);
  return { mapping, jobFunctionTerms, creditsUsed, creditsRemaining };
}

export async function getJobTitleMappingBundle(input: {
  jobTitle: string;
  allowFetch?: boolean;
}): Promise<{
  configured: boolean;
  mapping: JobTitleMapping | null;
  creditsUsed: number;
  creditsRemaining: number | null;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
}> {
  const configured = isSumbleConfigured();
  const jobTitle = input.jobTitle.trim();
  const creditsRemaining = getSumbleCreditsRemaining();

  if (!configured) {
    return {
      configured: false,
      mapping: null,
      creditsUsed: 0,
      creditsRemaining,
      error: "Sumble is not configured.",
    };
  }

  if (!jobTitle) {
    return {
      configured: true,
      mapping: null,
      creditsUsed: 0,
      creditsRemaining,
      error: "Job title is required.",
    };
  }

  const cacheKey = insightsCacheKey("sumble-title-lookup", { title: jobTitle.toLowerCase() });
  const cached = getInsightsCached<{ mapping: JobTitleMapping; jobFunctionTerms: string[] }>(cacheKey);
  if (cached) {
    return {
      configured: true,
      mapping: cached.mapping,
      creditsUsed: 0,
      creditsRemaining,
      requiresLoad: false,
    };
  }

  if (!input.allowFetch) {
    return {
      configured: true,
      mapping: null,
      creditsUsed: 0,
      creditsRemaining,
      requiresLoad: true,
      estimatedCredits: SUMBLE_ESTIMATED_COSTS.titleLookup,
    };
  }

  try {
    assertSumbleCreditsAvailable(SUMBLE_ESTIMATED_COSTS.titleLookup);
    const resolved = await resolveTitleMapping(jobTitle);
    return {
      configured: true,
      mapping: resolved.mapping,
      creditsUsed: resolved.creditsUsed,
      creditsRemaining: resolved.creditsRemaining,
      requiresLoad: false,
    };
  } catch (err) {
    return {
      configured: true,
      mapping: null,
      creditsUsed: 0,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
      error: err instanceof Error ? err.message : "Title lookup failed.",
    };
  }
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
    titleMapping: null,
    hiringTeams: [],
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

  const cacheKey = insightsCacheKey("sumble-job-contacts-v2", { companyName, jobTitle, domain });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<JobInsiderConnectionsBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);

    let creditsUsed = 0;
    let creditsRemainingAfter: number | null = creditsRemaining;

    const titleResolved = await resolveTitleMapping(jobTitle || "Product Manager");
    creditsUsed += titleResolved.creditsUsed;
    creditsRemainingAfter = titleResolved.creditsRemaining ?? creditsRemainingAfter;
    const jobFunctionTerms = titleResolved.jobFunctionTerms;
    const titleMapping = titleResolved.mapping;

    const match = await fetchSumbleOrganizationMatch({ domain, name: companyName });
    creditsUsed += match.creditsUsed;
    creditsRemainingAfter = match.creditsRemaining ?? creditsRemainingAfter;

    if (!match.organizationId) {
      const bundle: JobInsiderConnectionsBundle = {
        ...empty,
        titleMapping,
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

    const [hiringResult, teamsResult, peopleResult] = await Promise.all([
      jobTitle
        ? fetchSumbleJobRelatedPeople({
            organizationId: match.organizationId,
            jobTitle,
            relatedPeopleLimit: 5,
          })
        : Promise.resolve({
            job: null,
            relatedPeople: [] as SumbleRelatedPersonRow[],
            creditsUsed: 0,
            creditsRemaining: creditsRemainingAfter,
          }),
      fetchSumbleTeamsForJobFunction({
        organizationId: match.organizationId,
        jobFunctionTerm: jobFunctionTerms[0] ?? sumbleJobFunctionTerm(jobTitle || "Product Manager"),
        teamsLimit: 2,
        peoplePerTeam: 5,
      }),
      fetchSumblePeopleAtOrganization({
        organizationId: match.organizationId,
        limit: 5,
        jobFunctionTerms,
      }),
    ]);

    creditsUsed += hiringResult.creditsUsed + teamsResult.creditsUsed + peopleResult.creditsUsed;
    creditsRemainingAfter =
      peopleResult.creditsRemaining ?? teamsResult.creditsRemaining ?? hiringResult.creditsRemaining ?? creditsRemainingAfter;

    const hiringManagers = hiringResult.relatedPeople
      .map((p) => mapRelatedPerson(p, "hiring"))
      .filter(Boolean) as InsiderConnectionPerson[];

    const hiringTeams: JobHiringTeam[] = teamsResult.teams.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      sumbleUrl: team.sumbleUrl,
      jobsCount: team.jobsCount,
      people: team.relatedPeople
        .map((p) => mapRelatedPerson(p, "team"))
        .filter(Boolean) as InsiderConnectionPerson[],
    }));

    const teamPeopleIds = new Set(
      hiringTeams.flatMap((t) => t.people.map((p) => p.personId).filter(Boolean) as number[])
    );
    const hiringIds = new Set(hiringManagers.map((p) => p.personId).filter(Boolean) as number[]);

    const orgPeople = peopleResult.people
      .map((p) => mapPersonRow(p, "org"))
      .filter(Boolean)
      .filter((p) => {
        if (p!.personId != null && (teamPeopleIds.has(p!.personId) || hiringIds.has(p!.personId))) return false;
        return true;
      }) as InsiderConnectionPerson[];

    const bundle: JobInsiderConnectionsBundle = {
      configured: true,
      companyName: match.organizationName ?? companyName,
      jobTitle,
      domain,
      organizationId: match.organizationId,
      sumbleJobUrl: hiringResult.job?.sumble_url ?? null,
      titleMapping,
      hiringTeams,
      hiringManagers: dedupePeople(hiringManagers),
      orgPeople: dedupePeople(orgPeople),
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

export type PersonNetworkExpandBundle = {
  configured: boolean;
  sourcePersonId: number;
  sourcePersonName: string | null;
  managers: InsiderConnectionPerson[];
  peers: InsiderConnectionPerson[];
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  serverCached: boolean;
  requiresLoad?: boolean;
  estimatedCredits?: number;
  error?: string;
};

export async function getPersonNetworkExpandBundle(input: {
  personId: number;
  allowFetch?: boolean;
  forceRefresh?: boolean;
}): Promise<PersonNetworkExpandBundle> {
  const configured = isSumbleConfigured();
  const creditsRemaining = getSumbleCreditsRemaining();
  const estimatedCredits = SUMBLE_ESTIMATED_COSTS.personNetworkExpand;

  const empty: PersonNetworkExpandBundle = {
    configured,
    sourcePersonId: input.personId,
    sourcePersonName: null,
    managers: [],
    peers: [],
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

  if (!Number.isFinite(input.personId) || input.personId <= 0) {
    return { ...empty, requiresLoad: undefined, error: "Valid personId is required." };
  }

  const cacheKey = insightsCacheKey("sumble-person-network", { personId: input.personId });

  if (!input.forceRefresh) {
    const hit = getInsightsCached<PersonNetworkExpandBundle>(cacheKey);
    if (hit) return { ...hit, serverCached: true, requiresLoad: false };
  }

  if (!input.allowFetch) {
    return empty;
  }

  try {
    assertSumbleCreditsAvailable(estimatedCredits);
    const result = await fetchSumblePersonRelatedNetwork({ personId: input.personId });

    const managers = result.managers
      .map((p) => mapRelatedPerson(p, "manager"))
      .filter(Boolean) as InsiderConnectionPerson[];

    const peers = result.directReports
      .map((p) => mapRelatedPerson(p, "peer"))
      .filter(Boolean) as InsiderConnectionPerson[];

    const bundle: PersonNetworkExpandBundle = {
      configured: true,
      sourcePersonId: input.personId,
      sourcePersonName: result.sourcePerson?.attributes?.name?.trim() ?? null,
      managers: dedupePeople(managers),
      peers: dedupePeople(peers),
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
          : "Network expand failed.";
    return {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}
