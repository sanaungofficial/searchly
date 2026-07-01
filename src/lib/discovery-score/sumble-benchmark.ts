import { DISCOVERY_COHORT_SIZE } from "./constants";
import { resolveDiscoveryBenchmark, type DiscoveryBenchmarkResolution } from "./benchmark-role";
import { buildSumbleJobsQueryLadder, buildSumblePeopleQueryLadder } from "./query-build";
import type { DiscoveryBenchmarkProfile, DiscoveryProfileContext } from "./types";
import { isSumbleConfigured, sumblePost } from "@/lib/sumble/client";

type SumblePersonAttributes = {
  name?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  organization_name?: string | null;
  current_employer?: { name?: string | null } | null;
};

type SumbleRelatedPerson = {
  person_id?: number | null;
  attributes?: SumblePersonAttributes | null;
};

type SumblePersonRow = {
  person_id?: number | null;
  attributes?: SumblePersonAttributes | null;
};

type SumblePeopleResponse = {
  people?: SumblePersonRow[];
  total?: number;
};

type SumbleJobRow = {
  attributes?: { title?: string | null } | null;
  related_people?: SumbleRelatedPerson[] | null;
};

type SumbleJobsResponse = {
  jobs?: SumbleJobRow[];
};

type SumbleOrgRow = {
  attributes?: { id?: number | null; name?: string | null } | null;
};

type SumbleOrgsResponse = {
  organizations?: SumbleOrgRow[];
};

export type SumbleBenchmarkFetchResult = {
  people: DiscoveryBenchmarkProfile[];
  queryUsed: string | null;
  benchmark: ReturnType<typeof resolveDiscoveryBenchmark>;
};

function escapeQueryTerm(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function companyFromAttributes(attrs: SumblePersonAttributes | null | undefined): string | null {
  return (
    attrs?.current_employer?.name?.trim() ??
    attrs?.organization_name?.trim() ??
    null
  );
}

function mapToBenchmark(row: SumblePersonRow | SumbleRelatedPerson): DiscoveryBenchmarkProfile | null {
  const name = row.attributes?.name?.trim();
  const linkedinUrl = row.attributes?.linkedin_url?.trim();
  if (!name || !linkedinUrl) return null;
  return {
    name,
    title: row.attributes?.job_title?.trim() ?? null,
    company: companyFromAttributes(row.attributes),
    linkedinUrl,
    thumbnailUrl: null,
  };
}

function dedupeBenchmarks(people: DiscoveryBenchmarkProfile[]): DiscoveryBenchmarkProfile[] {
  const seen = new Set<string>();
  const out: DiscoveryBenchmarkProfile[] = [];
  for (const person of people) {
    const key = person.linkedinUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(person);
  }
  return out;
}

function relatedPeopleSelect(benchmark: DiscoveryBenchmarkResolution, perJobLimit: number) {
  return {
    limit: perJobLimit,
    attributes: ["name", "job_title", "linkedin_url", "job_function", "job_level"],
    ...(benchmark.sumbleJobFunction ? { job_functions: [benchmark.sumbleJobFunction] } : {}),
    ...(benchmark.sumbleJobLevel ? { job_levels: [benchmark.sumbleJobLevel] } : {}),
    sort_order: "level" as const,
    sort_direction: "desc" as const,
  };
}

/** Global job search + related hiring managers — Sumble people search requires org scope. */
async function fetchPeopleViaJobsQuery(
  query: string,
  benchmark: DiscoveryBenchmarkResolution,
  limit: number,
): Promise<DiscoveryBenchmarkProfile[]> {
  const res = await sumblePost<SumbleJobsResponse>("/v6/jobs", {
    filter: { query: { query } },
    limit: Math.min(8, Math.max(3, Math.ceil(limit / 2))),
    select: {
      attributes: ["title"],
      related_people: relatedPeopleSelect(benchmark, Math.min(limit, 8)),
    },
  });

  if (!res.ok) return [];

  const collected: DiscoveryBenchmarkProfile[] = [];
  for (const job of res.data.jobs ?? []) {
    for (const person of job.related_people ?? []) {
      const mapped = mapToBenchmark(person);
      if (mapped) collected.push(mapped);
    }
  }
  return dedupeBenchmarks(collected);
}

async function fetchOrganizationIdsForJobFunction(jobFunction: string, limit: number): Promise<number[]> {
  const term = escapeQueryTerm(jobFunction);
  const res = await sumblePost<SumbleOrgsResponse>("/v6/organizations", {
    filter: { query: { query: `job_function EQ "${term}"` } },
    limit: Math.min(limit, 12),
    select: { attributes: ["id", "name"] },
  });

  if (!res.ok) return [];

  const ids: number[] = [];
  for (const row of res.data.organizations ?? []) {
    const id = row.attributes?.id;
    if (typeof id === "number" && id > 0) ids.push(id);
  }
  return ids;
}

/** People search scoped to organizations that employ the target job function. */
async function fetchPeopleViaOrgScope(
  query: string,
  organizationIds: number[],
  limit: number,
): Promise<DiscoveryBenchmarkProfile[]> {
  if (!organizationIds.length) return [];

  const res = await sumblePost<SumblePeopleResponse>("/v6/people", {
    filter: {
      organization_ids: organizationIds.slice(0, 12),
      query: { query },
    },
    limit,
    order_by_column: "job_level",
    order_by_direction: "DESC",
    select: {
      attributes: ["name", "job_title", "linkedin_url", "current_employer"],
    },
  });

  if (!res.ok) return [];

  return dedupeBenchmarks(
    (res.data.people ?? [])
      .map((row) => mapToBenchmark(row))
      .filter((p): p is DiscoveryBenchmarkProfile => Boolean(p)),
  );
}

async function fetchPeopleViaRoleTitleJobs(
  ctx: DiscoveryProfileContext,
  benchmark: DiscoveryBenchmarkResolution,
  limit: number,
): Promise<DiscoveryBenchmarkProfile[]> {
  const roles = ctx.prioritizedRoles.length ? ctx.prioritizedRoles : ctx.targetRoles;
  const collected: DiscoveryBenchmarkProfile[] = [];

  for (const role of roles.slice(0, 3)) {
    if (collected.length >= limit) break;
    const titleTokens = role
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 4)
      .join(" ");
    if (!titleTokens) continue;

    const fnClause = benchmark.sumbleJobFunction
      ? `job_function EQ "${escapeQueryTerm(benchmark.sumbleJobFunction)}" AND `
      : "";
    const res = await sumblePost<SumbleJobsResponse>("/v6/jobs", {
      filter: { query: { query: `${fnClause}title CONTAINS "${escapeQueryTerm(titleTokens)}"` } },
      limit: 4,
      select: {
        attributes: ["title"],
        related_people: relatedPeopleSelect(benchmark, Math.min(limit, 8)),
      },
    });

    if (!res.ok) continue;

    for (const job of res.data.jobs ?? []) {
      for (const person of job.related_people ?? []) {
        const mapped = mapToBenchmark(person);
        if (mapped) collected.push(mapped);
      }
    }
  }

  return dedupeBenchmarks(collected);
}

export async function fetchBenchmarkPeopleFromSumble(
  ctx: DiscoveryProfileContext,
  cohortSize = DISCOVERY_COHORT_SIZE,
): Promise<SumbleBenchmarkFetchResult> {
  const benchmark = resolveDiscoveryBenchmark(ctx);
  if (!isSumbleConfigured()) {
    return { people: [], queryUsed: null, benchmark };
  }

  const minAcceptable = Math.min(3, cohortSize);
  let people: DiscoveryBenchmarkProfile[] = [];
  let queryUsed: string | null = null;

  // 1) Jobs corpus (global) — primary path for benchmark peers
  for (const step of buildSumbleJobsQueryLadder(ctx, benchmark)) {
    const batch = await fetchPeopleViaJobsQuery(step.query, benchmark, cohortSize);
    people = dedupeBenchmarks([...people, ...batch]);
    if (batch.length && !queryUsed) queryUsed = step.query;
    if (people.length >= minAcceptable) break;
  }

  // 2) Org-scoped people search — Sumble requires organization_ids for /v6/people
  if (people.length < minAcceptable && benchmark.sumbleJobFunction) {
    const orgIds = await fetchOrganizationIdsForJobFunction(benchmark.sumbleJobFunction, 10);
    if (orgIds.length) {
      for (const step of buildSumblePeopleQueryLadder(ctx, benchmark)) {
        const batch = await fetchPeopleViaOrgScope(step.query, orgIds, cohortSize);
        people = dedupeBenchmarks([...people, ...batch]);
        if (batch.length && !queryUsed) queryUsed = `org-scoped: ${step.query}`;
        if (people.length >= minAcceptable) break;
      }
    }
  }

  // 3) Title-based job fallback when function mapping is weak
  if (people.length < minAcceptable) {
    const fallback = await fetchPeopleViaRoleTitleJobs(ctx, benchmark, cohortSize);
    people = dedupeBenchmarks([...people, ...fallback]);
    if (fallback.length && !queryUsed) queryUsed = "job title fallback";
  }

  return {
    people: people.slice(0, cohortSize),
    queryUsed,
    benchmark,
  };
}
