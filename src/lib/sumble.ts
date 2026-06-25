import { formatApiErrorMessage } from "@/lib/api-error-message";
import { hostnameFromUrl } from "@/lib/company-domain";
import { recordSumbleCreditsRemaining } from "@/lib/sumble-credits";

const SUMBLE_BASE = "https://api.sumble.com/v6";

const ORG_LOOKUP_ATTRIBUTES = [
  "id",
  "name",
  "slug",
  "url",
  "employee_count",
  "industry",
  "jobs_count",
  "teams_count",
  "headquarters_country",
  "sumble_score",
  "sumble_url",
  "funding_total_raised",
  "funding_last_round_type",
  "funding_last_round_date",
] as const;

export type SumbleOrganizationAttributes = {
  id?: number | null;
  slug?: string | null;
  name?: string | null;
  url?: string | null;
  employee_count?: number | null;
  industry?: string | null;
  jobs_count?: number | null;
  teams_count?: number | null;
  headquarters_country?: string | null;
  sumble_score?: number | null;
  sumble_url?: string | null;
  funding_total_raised?: number | null;
  funding_last_round_type?: string | null;
  funding_last_round_date?: string | null;
};

export type SumbleEntityResult = {
  type: string;
  term: string;
  job_post_count?: number | null;
  job_post_count_url?: string | null;
  people_count?: number | null;
  people_count_url?: string | null;
  team_count?: number | null;
  job_post_count_growth_1y?: number | null;
  people_count_growth_1y?: number | null;
};

export type SumbleOrganizationRow = {
  input?: { name?: string | null; url?: string | null } | null;
  attributes?: SumbleOrganizationAttributes | null;
  entities?: SumbleEntityResult[];
};

export type SumbleSignal = {
  title: string;
  subtitle?: string | null;
  explanation?: string | null;
  date: string;
  display_type: string;
  type?: string | null;
  organization_name?: string | null;
  job_function?: string | null;
  sumble_url?: string | null;
  linkedin_url?: string | null;
};

export type SumblePersonAttributes = {
  name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  job_title?: string | null;
  job_function?: string | null;
  job_level?: string | null;
  location?: string | null;
};

export type SumblePersonRow = {
  person_id?: number | null;
  sumble_url?: string | null;
  attributes?: SumblePersonAttributes | null;
};

export type SumbleTeamAttributes = {
  name?: string | null;
  jobs_count?: number | null;
  people_count?: number | null;
  technology_list?: string[] | null;
};

export type SumbleTeamRow = {
  team_id?: number | null;
  name?: string | null;
  sumble_url?: string | null;
  attributes?: SumbleTeamAttributes | null;
  related_people?: SumbleTeamRelatedPersonRow[] | null;
};

export type SumbleTeamRelatedPersonRow = {
  person_id?: number | null;
  sumble_url?: string | null;
  confidence?: { score?: number | null } | null;
  attributes?: SumblePersonAttributes | null;
};

export type SumbleDashboardSignal = SumbleSignal & {
  companyName: string;
  companyDomain: string | null;
  trackedId: string | null;
};

export type SumbleJobOrganization = {
  organization_id?: number;
  name?: string | null;
  domain?: string | null;
  sumble_url?: string | null;
};

export type SumbleJobAttributes = {
  title?: string | null;
  location?: string | null;
  posted_date?: string | null;
  organization?: SumbleJobOrganization | null;
  technologies?: Array<{ name: string; slug?: string; used?: boolean }>;
  teams?: Array<{ name: string; slug?: string }>;
  job_functions?: Array<{ name: string; slug?: string }>;
  job_levels?: Array<{ name: string }>;
  projects?: Array<{ name: string; slug?: string; goal?: string | null }>;
};

export type SumbleRelatedPersonRow = {
  person_id?: number;
  sumble_url?: string | null;
  attributes?: SumblePersonAttributes | null;
  confidence?: { score?: number } | null;
};

export type SumbleJobRow = {
  job_id?: number | null;
  sumble_url?: string | null;
  attributes?: SumbleJobAttributes | null;
  related_people?: SumbleRelatedPersonRow[] | null;
};

export type SumbleIntelligenceBrief = {
  organization_id: number;
  organization_slug: string;
  title: string;
  body: string;
  sumble_url: string;
};

export type SumbleTitleLookupResult = {
  input: string;
  job_function: string | null;
  job_level: string | null;
};

export type SumbleTechnologyHit = {
  slug: string;
  name: string;
  count: number;
};

export type SumbleProjectLookupResult = {
  input: string;
  project: { name: string; slug: string; goal?: string | null } | null;
};

export type SumbleOrganizationListSummary = {
  id: number;
  name: string;
  url: string;
  organizations_count: number;
  include_in_signals?: boolean;
};

type SumbleEnvelope<T> = {
  id?: string;
  credits_used?: number;
  credits_remaining?: number;
  organizations?: SumbleOrganizationRow[];
  signals?: SumbleSignal[];
  people?: SumblePersonRow[];
  jobs?: SumbleJobRow[];
  matched_count?: number | null;
  total?: number;
  teams?: SumbleTeamRow[];
};

export function isSumbleConfigured(): boolean {
  return !!process.env.SUMBLE_API_KEY?.trim();
}

function getApiKey(): string {
  const key = process.env.SUMBLE_API_KEY?.trim();
  if (!key) throw new Error("SUMBLE_API_KEY is not configured.");
  return key;
}

async function sumbleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUMBLE_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(45000),
  });

  if (res.status === 404) {
    throw new SumbleNotFoundError(path);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `Sumble request failed (${res.status})`;
    if (body.trim()) {
      try {
        message = formatApiErrorMessage(JSON.parse(body), message);
      } catch {
        message = body.trim();
      }
    }
    throw new Error(message);
  }

  const data = (await res.json()) as T & { credits_remaining?: number | null };
  recordSumbleCreditsRemaining(data.credits_remaining);
  return data;
}

type SumbleFetchResult<T> = {
  status: number;
  data: T;
  retryAfterSec: number | null;
};

async function sumbleFetchWithStatus<T>(
  path: string,
  init?: RequestInit
): Promise<SumbleFetchResult<T>> {
  const res = await fetch(`${SUMBLE_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(45000),
  });

  if (res.status === 404) {
    throw new SumbleNotFoundError(path);
  }

  const retryAfterHeader = res.headers.get("Retry-After");
  const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

  if (res.status === 202) {
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: 202, data, retryAfterSec };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `Sumble request failed (${res.status})`;
    if (body.trim()) {
      try {
        message = formatApiErrorMessage(JSON.parse(body), message);
      } catch {
        message = body.trim();
      }
    }
    throw new Error(message);
  }

  const data = (await res.json()) as T & { credits_remaining?: number | null };
  recordSumbleCreditsRemaining(data.credits_remaining);
  return { status: res.status, data, retryAfterSec };
}

export class SumbleNotFoundError extends Error {
  constructor(path: string) {
    super(`Sumble resource not found: ${path}`);
    this.name = "SumbleNotFoundError";
  }
}

/** Map Kimchi target role labels to Sumble job_function entity terms. */
export function sumbleJobFunctionTerm(role: string): string {
  const r = role.trim();
  if (!r) return "Product Management";
  const lower = r.toLowerCase();
  if (lower.includes("product")) return "Product Management";
  if (lower.includes("engineer") || lower.includes("developer") || lower.includes("software")) {
    return "Software Engineering";
  }
  if (lower.includes("design")) return "Design";
  if (lower.includes("data")) return "Data";
  if (lower.includes("marketing")) return "Marketing";
  if (lower.includes("sales")) return "Sales";
  if (lower.includes("operations")) return "Operations";
  return r;
}

function normalizeSumbleDomain(domain?: string | null): string | null {
  const raw = domain?.trim();
  if (!raw) return null;
  return hostnameFromUrl(raw) ?? raw.replace(/^www\./i, "");
}

function organizationMatched(row: SumbleOrganizationRow | null | undefined): boolean {
  const attrs = row?.attributes;
  if (!attrs) return false;
  return (
    attrs.id != null ||
    !!attrs.name?.trim() ||
    attrs.employee_count != null ||
    attrs.jobs_count != null
  );
}

function buildOrgLookupAttempts(input: {
  domain?: string | null;
  name?: string | null;
  slug?: string | null;
}): Record<string, string>[] {
  const name = input.name?.trim() || null;
  const domain = normalizeSumbleDomain(input.domain);
  const slug = input.slug?.trim() || null;
  const attempts: Record<string, string>[] = [];

  if (slug) attempts.push({ slug });
  if (domain) attempts.push({ url: domain });
  if (name && domain) attempts.push({ name, url: domain });
  if (name) attempts.push({ name });

  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = JSON.stringify(attempt);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchSumbleOrganization(input: {
  domain?: string | null;
  name?: string | null;
  slug?: string | null;
  jobFunctionTerms?: string[];
  includeRoleMetrics?: boolean;
}): Promise<{
  organization: SumbleOrganizationRow | null;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const attempts = buildOrgLookupAttempts(input);
  if (!attempts.length) throw new Error("Organization domain, name, or slug is required.");

  const includeRoleMetrics = input.includeRoleMetrics !== false;
  const entities = includeRoleMetrics
    ? (input.jobFunctionTerms ?? ["Product Management"]).slice(0, 3).map((term) => ({
        type: "job_function" as const,
        term,
        metrics: ["job_post_count", "people_count", "job_post_count_growth_1y", "team_count"],
      }))
    : [];

  let creditsUsed = 0;
  let creditsRemaining: number | null = null;

  for (const orgInput of attempts) {
    const data = await sumbleFetch<SumbleEnvelope<unknown>>("/organizations", {
      method: "POST",
      body: JSON.stringify({
        organizations: [orgInput],
        select: {
          attributes: [...ORG_LOOKUP_ATTRIBUTES],
          entities,
        },
      }),
    });

    creditsUsed += data.credits_used ?? 0;
    creditsRemaining = data.credits_remaining ?? creditsRemaining;

    const organization = data.organizations?.[0] ?? null;
    if (organizationMatched(organization) || data.matched_count === 1) {
      return { organization, creditsUsed, creditsRemaining };
    }
  }

  return { organization: null, creditsUsed, creditsRemaining };
}

/** Lightweight org resolve — id/name only, no role metrics (1 credit typical). */
export async function fetchSumbleOrganizationMatch(input: {
  domain?: string | null;
  name?: string | null;
}): Promise<{
  organizationId: number | null;
  organizationName: string | null;
  sumbleUrl: string | null;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const result = await fetchSumbleOrganization({
    ...input,
    includeRoleMetrics: false,
    jobFunctionTerms: [],
  });
  const attrs = result.organization?.attributes;
  return {
    organizationId: attrs?.id ?? null,
    organizationName: attrs?.name ?? null,
    sumbleUrl: attrs?.sumble_url ?? null,
    creditsUsed: result.creditsUsed,
    creditsRemaining: result.creditsRemaining,
  };
}

export async function fetchSumbleOrganizationSignals(organizationId: number): Promise<{
  signals: SumbleSignal[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const data = await sumbleFetch<SumbleEnvelope<unknown>>(
    `/organizations/${organizationId}/signals`,
    { method: "GET" }
  );

  return {
    signals: data.signals ?? [],
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumblePeopleAtOrganization(input: {
  organizationId: number;
  limit?: number;
  jobFunctionTerms?: string[];
}): Promise<{
  people: SumblePersonRow[];
  total: number;
  creditsUsed: number;
  creditsRemaining: number | null;
  sourceDataUrl: string | null;
  filteredByRole: boolean;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 10));
  const primaryRole = input.jobFunctionTerms?.[0]?.trim();

  const buildFilter = (withRoleQuery: boolean) => {
    const filter: Record<string, unknown> = { organization_ids: [input.organizationId] };
    if (withRoleQuery && primaryRole) {
      filter.query = { query: `job_function EQ '${primaryRole.replace(/'/g, "\\'")}'` };
    }
    return filter;
  };

  const runPeopleSearch = async (withRoleQuery: boolean) => {
    const data = await sumbleFetch<SumbleEnvelope<unknown>>("/people", {
      method: "POST",
      body: JSON.stringify({
        filter: buildFilter(withRoleQuery),
        limit: withRoleQuery ? limit : Math.min(limit * 4, 25),
        order_by_column: "job_level",
        order_by_direction: "DESC",
        select: {
          attributes: ["name", "job_title", "linkedin_url", "job_level", "job_function"],
        },
      }),
    });
    return data;
  };

  let filteredByRole = false;
  let data: SumbleEnvelope<unknown>;

  if (primaryRole) {
    try {
      data = await runPeopleSearch(true);
      filteredByRole = true;
    } catch {
      data = await runPeopleSearch(false);
      filteredByRole = false;
    }
  } else {
    data = await runPeopleSearch(false);
  }

  let people = data.people ?? [];

  if (primaryRole && !filteredByRole && people.length) {
    const roleLower = primaryRole.toLowerCase();
    const roleFiltered = people.filter((row) => {
      const fn = row.attributes?.job_function?.trim().toLowerCase();
      return fn === roleLower || fn?.includes(roleLower) || roleLower.includes(fn ?? "");
    });
    if (roleFiltered.length) {
      people = roleFiltered;
      filteredByRole = true;
    }
  }

  people = people.slice(0, limit);

  return {
    people,
    total: data.total ?? people.length,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
    sourceDataUrl: (data as { source_data_url?: string | null }).source_data_url ?? null,
    filteredByRole,
  };
}

export async function fetchSumbleTeamsAtOrganization(input: {
  organizationId: number;
  limit?: number;
}): Promise<{
  teams: SumbleTeamRow[];
  total: number;
  creditsUsed: number;
  creditsRemaining: number | null;
  sourceDataUrl: string | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 10));

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/teams", {
    method: "POST",
    body: JSON.stringify({
      filter: { organization_ids: [input.organizationId] },
      limit,
      order_by_column: "jobs_count",
      order_by_direction: "DESC",
      select: {
        attributes: ["jobs_count", "job_function_list", "technology_list"],
      },
    }),
  });

  return {
    teams: data.teams ?? [],
    total: data.total ?? 0,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
    sourceDataUrl: (data as { source_data_url?: string | null }).source_data_url ?? null,
  };
}

export type SumbleTeamWithPeople = {
  teamId: number | null;
  teamName: string;
  sumbleUrl: string | null;
  jobsCount: number | null;
  relatedPeople: SumbleTeamRelatedPersonRow[];
};

/** Teams at an org filtered by job function, with related people for networking. */
export async function fetchSumbleTeamsForJobFunction(input: {
  organizationId: number;
  jobFunctionTerm: string;
  teamsLimit?: number;
  peoplePerTeam?: number;
}): Promise<{
  teams: SumbleTeamWithPeople[];
  creditsUsed: number;
  creditsRemaining: number | null;
  sourceDataUrl: string | null;
}> {
  const term = input.jobFunctionTerm.trim();
  if (!term) throw new Error("Job function term is required.");

  const teamsLimit = Math.max(1, Math.min(input.teamsLimit ?? 2, 3));
  const peoplePerTeam = Math.max(1, Math.min(input.peoplePerTeam ?? 5, 8));

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/teams", {
    method: "POST",
    body: JSON.stringify({
      filter: {
        organization_ids: [input.organizationId],
        query: { query: jobFunctionQuery(term) },
      },
      limit: teamsLimit,
      order_by_column: "jobs_count",
      order_by_direction: "DESC",
      select: {
        attributes: ["jobs_count", "job_function_list"],
        related_people: {
          attributes: ["name", "linkedin_url", "job_title", "job_level", "job_function"],
          max_per_team: peoplePerTeam,
        },
      },
    }),
  });

  const teams = (data.teams ?? [])
    .map((row) => {
      const teamRow = row as SumbleTeamRow;
      const name = teamRow.name?.trim() || teamRow.attributes?.name?.trim();
      if (!name) return null;
      return {
        teamId: teamRow.team_id ?? null,
        teamName: name,
        sumbleUrl: teamRow.sumble_url ?? null,
        jobsCount: teamRow.attributes?.jobs_count ?? null,
        relatedPeople: teamRow.related_people ?? [],
      };
    })
    .filter(Boolean) as SumbleTeamWithPeople[];

  return {
    teams,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
    sourceDataUrl: (data as { source_data_url?: string | null }).source_data_url ?? null,
  };
}

function escapeSumbleQueryTerm(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function jobFunctionQuery(term: string): string {
  return `job_function EQ '${escapeSumbleQueryTerm(term)}'`;
}

export async function fetchSumbleJobsSearch(input: {
  jobFunctionTerm: string;
  limit?: number;
}): Promise<{
  jobs: SumbleJobRow[];
  total: number;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 50));
  const term = input.jobFunctionTerm.trim() || "Product Management";

  const attempts = [jobFunctionQuery(term)];

  let lastError: Error | null = null;
  for (const query of attempts) {
    try {
      const data = await sumbleFetch<SumbleEnvelope<unknown>>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          filter: { query: { query } },
          limit,
          select: {
            attributes: [
              "title",
              "location",
              "posted_date",
              "organization",
              "technologies",
              "job_levels",
              "projects",
            ],
          },
        }),
      });

      return {
        jobs: data.jobs ?? [],
        total: data.total ?? data.jobs?.length ?? 0,
        creditsUsed: data.credits_used ?? 0,
        creditsRemaining: data.credits_remaining ?? null,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Sumble job search failed.");
}

export async function fetchSumbleTopHiringOrganizations(input: {
  jobFunctionTerm: string;
  limit?: number;
}): Promise<{
  organizations: Array<{ name: string; domain: string | null; jobPostCount: number }>;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
  const term = input.jobFunctionTerm.trim() || "Product Management";

  try {
    const data = await sumbleFetch<SumbleEnvelope<unknown>>("/organizations", {
      method: "POST",
      body: JSON.stringify({
        filter: { query: { query: jobFunctionQuery(term) } },
        limit,
        order_by_column: "jobs_count",
        order_by_direction: "DESC",
        select: {
          attributes: ["name", "url", "jobs_count", "employee_count"],
          entities: [
            {
              type: "job_function",
              term,
              metrics: ["job_post_count"],
            },
          ],
        },
      }),
    });

    const organizations = (data.organizations ?? [])
      .map((row) => {
        const attrs = row.attributes;
        const entity = row.entities?.find((e) => e.type === "job_function" && e.term === term);
        const count = entity?.job_post_count ?? attrs?.jobs_count ?? 0;
        if (!attrs?.name?.trim() || !count) return null;
        return {
          name: attrs.name.trim(),
          domain: attrs.url ?? null,
          jobPostCount: count,
        };
      })
      .filter(Boolean) as Array<{ name: string; domain: string | null; jobPostCount: number }>;

    return {
      organizations,
      creditsUsed: data.credits_used ?? 0,
      creditsRemaining: data.credits_remaining ?? null,
    };
  } catch {
    return { organizations: [], creditsUsed: 0, creditsRemaining: null };
  }
}

export function formatSumbleFunding(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatSumbleGrowth(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(value * 100);
  if (pct > 0) return `+${pct}% YoY`;
  if (pct < 0) return `${pct}% YoY`;
  return "Flat YoY";
}

function escapeTitleForQuery(title: string): string {
  return title.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Resolve job function terms via Sumble title-lookup (cached by caller). Falls back to heuristic. */
export async function lookupSumbleJobFunctionTerms(titles: string[]): Promise<{
  terms: string[];
  results: SumbleTitleLookupResult[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))].slice(0, 5);
  if (!unique.length) {
    return { terms: ["Product Management"], results: [], creditsUsed: 0, creditsRemaining: null };
  }

  const data = await sumbleFetch<{
    credits_used?: number;
    credits_remaining?: number | null;
    results?: Array<{
      input?: string;
      job_function?: { name?: string } | null;
      job_level?: { name?: string } | null;
    }>;
  }>("/jobs/title-lookup", {
    method: "POST",
    body: JSON.stringify({ titles: unique }),
  });

  const results: SumbleTitleLookupResult[] = (data.results ?? []).map((row) => ({
    input: row.input ?? "",
    job_function: row.job_function?.name ?? null,
    job_level: row.job_level?.name ?? null,
  }));

  const fromLookup = results
    .map((r) => r.job_function?.trim())
    .filter(Boolean) as string[];
  const fallback = unique.map(sumbleJobFunctionTerm);
  const terms = [...new Set([...fromLookup, ...fallback])].slice(0, 3);

  return {
    terms,
    results,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumbleJobRelatedPeople(input: {
  organizationId: number;
  jobTitle: string;
  relatedPeopleLimit?: number;
}): Promise<{
  job: SumbleJobRow | null;
  relatedPeople: SumbleRelatedPersonRow[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const title = input.jobTitle.trim();
  const relatedLimit = Math.max(1, Math.min(input.relatedPeopleLimit ?? 5, 8));
  const titleClause = title
    ? ` AND title CONTAINS '${escapeTitleForQuery(title.slice(0, 80))}'`
    : "";
  const query = `organization_id EQ ${input.organizationId}${titleClause}`;

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/jobs", {
    method: "POST",
    body: JSON.stringify({
      filter: { organization_ids: [input.organizationId], query: { query } },
      limit: 1,
      select: {
        attributes: ["title", "organization", "job_functions"],
        related_people: {
          attributes: ["name", "linkedin_url", "job_title", "job_level", "job_function"],
          limit: relatedLimit,
        },
      },
    }),
  });

  const job = data.jobs?.[0] ?? null;
  return {
    job,
    relatedPeople: job?.related_people ?? [],
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumblePersonByLinkedIn(input: {
  linkedinUrl: string;
  revealEmail?: boolean;
}): Promise<{
  person: SumblePersonRow | null;
  email: string | null;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const attributes = ["name", "linkedin_url", "job_title", "job_level", "job_function", "current_employer"];
  if (input.revealEmail) attributes.push("email");

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/people", {
    method: "POST",
    body: JSON.stringify({
      people: [{ linkedin_url: input.linkedinUrl.trim() }],
      select: { attributes },
    }),
  });

  const person = data.people?.[0] ?? null;
  return {
    person,
    email: person?.attributes?.email ?? null,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumbleIntelligenceBrief(organizationId: number): Promise<{
  brief: SumbleIntelligenceBrief | null;
  pending: boolean;
  creditsUsed: number;
  creditsRemaining: number | null;
  message?: string;
}> {
  const maxAttempts = 4;
  let creditsUsed = 0;
  let creditsRemaining: number | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await sumbleFetchWithStatus<
      SumbleIntelligenceBrief & {
        credits_used?: number;
        credits_remaining?: number | null;
        status?: string;
        message?: string;
      }
    >(`/organizations/${organizationId}/intelligence-brief`, { method: "GET" });

    if (result.status === 202) {
      const waitSec = result.retryAfterSec ?? 3;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    creditsUsed += result.data.credits_used ?? 0;
    creditsRemaining = result.data.credits_remaining ?? creditsRemaining;

    return {
      brief: {
        organization_id: result.data.organization_id,
        organization_slug: result.data.organization_slug,
        title: result.data.title,
        body: result.data.body,
        sumble_url: result.data.sumble_url,
      },
      pending: false,
      creditsUsed,
      creditsRemaining,
    };
  }

  return {
    brief: null,
    pending: true,
    creditsUsed,
    creditsRemaining,
    message: "Intelligence brief is still generating. Try again in a minute.",
  };
}

export async function fetchSumbleSignalsSearch(input: {
  jobFunctionTerms?: string[];
  organizationIds?: number[];
  limit?: number;
}): Promise<{
  signals: SumbleSignal[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 8, 12));
  const filter: Record<string, unknown> = {};
  if (input.organizationIds?.length) {
    filter.organization_ids = input.organizationIds.slice(0, 10);
  }
  if (input.jobFunctionTerms?.length) {
    filter.job_functions = input.jobFunctionTerms.slice(0, 3);
  }

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/signals", {
    method: "POST",
    body: JSON.stringify({ filter, limit }),
  });

  return {
    signals: (data.signals ?? []).slice(0, limit),
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumbleGrowingEmployers(input: {
  jobFunctionTerm: string;
  limit?: number;
}): Promise<{
  organizations: Array<{
    name: string;
    domain: string | null;
    jobPostCount: number;
    growth1y: number | null;
    sumbleUrl: string | null;
  }>;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 12, 20));
  const term = input.jobFunctionTerm.trim() || "Product Management";

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/organizations", {
    method: "POST",
    body: JSON.stringify({
      filter: { query: { query: jobFunctionQuery(term) } },
      limit: Math.min(limit * 2, 30),
      order_by_column: "jobs_count",
      order_by_direction: "DESC",
      select: {
        attributes: ["name", "url", "jobs_count", "sumble_url"],
        entities: [
          {
            type: "job_function",
            term,
            metrics: ["job_post_count", "job_post_count_growth_1y"],
          },
        ],
      },
    }),
  });

  const organizations = (data.organizations ?? [])
    .map((row) => {
      const attrs = row.attributes;
      const entity = row.entities?.find((e) => e.type === "job_function" && e.term === term);
      const count = entity?.job_post_count ?? attrs?.jobs_count ?? 0;
      const growth = entity?.job_post_count_growth_1y ?? null;
      if (!attrs?.name?.trim() || growth == null) return null;
      return {
        name: attrs.name.trim(),
        domain: attrs.url ?? null,
        jobPostCount: count,
        growth1y: growth,
        sumbleUrl: attrs.sumble_url ?? null,
      };
    })
    .filter(Boolean) as Array<{
      name: string;
      domain: string | null;
      jobPostCount: number;
      growth1y: number | null;
      sumbleUrl: string | null;
    }>;

  organizations.sort((a, b) => (b.growth1y ?? 0) - (a.growth1y ?? 0));

  return {
    organizations: organizations.slice(0, limit),
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumbleProjectsFromJobs(input: {
  jobFunctionTerm: string;
  limit?: number;
}): Promise<{
  projects: Array<{ name: string; slug: string; goal: string | null; jobCount: number }>;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 15, 25));
  const term = input.jobFunctionTerm.trim() || "Product Management";

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/jobs", {
    method: "POST",
    body: JSON.stringify({
      filter: { query: { query: jobFunctionQuery(term) } },
      limit,
      select: { attributes: ["title", "projects"] },
    }),
  });

  const counts = new Map<string, { name: string; slug: string; goal: string | null; jobCount: number }>();
  for (const job of data.jobs ?? []) {
    for (const project of job.attributes?.projects ?? []) {
      const key = project.slug || project.name;
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.jobCount += 1;
      } else {
        counts.set(key, {
          name: project.name,
          slug: project.slug,
          goal: project.goal ?? null,
          jobCount: 1,
        });
      }
    }
  }

  const projects = [...counts.values()].sort((a, b) => b.jobCount - a.jobCount).slice(0, 12);

  return {
    projects,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumbleTechnologiesFind(query: string): Promise<{
  technologies: SumbleTechnologyHit[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const data = await sumbleFetch<{
    credits_used?: number;
    credits_remaining?: number | null;
    technologies?: SumbleTechnologyHit[];
    total_count?: number;
  }>("/technologies/find", {
    method: "POST",
    body: JSON.stringify({ query: query.trim() }),
  });

  return {
    technologies: data.technologies ?? [],
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function listSumbleOrganizationLists(): Promise<{
  lists: SumbleOrganizationListSummary[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const data = await sumbleFetch<{
    credits_used?: number;
    credits_remaining?: number | null;
    organization_lists?: SumbleOrganizationListSummary[];
  }>("/organization-lists", { method: "GET" });

  return {
    lists: data.organization_lists ?? [],
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function createSumbleOrganizationList(name: string): Promise<{
  id: number;
  name: string;
  url: string;
}> {
  const data = await sumbleFetch<{ id: number; name: string; url: string }>("/organization-lists", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data;
}

export async function addOrganizationsToSumbleList(input: {
  listId: number;
  organizationIds: number[];
}): Promise<{
  added: number[];
  failedIds: number[];
}> {
  const data = await sumbleFetch<{ added?: number[]; failed_ids?: number[] }>(
    `/organization-lists/${input.listId}/organizations`,
    {
      method: "POST",
      body: JSON.stringify({ organization_ids: input.organizationIds.slice(0, 20) }),
    }
  );
  return {
    added: data.added ?? [],
    failedIds: data.failed_ids ?? [],
  };
}
