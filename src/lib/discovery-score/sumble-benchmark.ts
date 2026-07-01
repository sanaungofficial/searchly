import { DISCOVERY_COHORT_SIZE } from "./constants";
import { resolveDiscoveryBenchmark } from "./benchmark-role";
import { buildSumblePeopleQueryLadder } from "./query-build";
import type { DiscoveryBenchmarkProfile, DiscoveryProfileContext } from "./types";
import { isSumbleConfigured, sumblePost } from "@/lib/sumble/client";

type SumbleRelatedPerson = {
  person_id?: number | null;
  attributes?: {
    name?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    organization_name?: string | null;
  } | null;
};

type SumblePersonRow = {
  person_id?: number | null;
  attributes?: {
    name?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    organization_name?: string | null;
  } | null;
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

export type SumbleBenchmarkFetchResult = {
  people: DiscoveryBenchmarkProfile[];
  queryUsed: string | null;
  benchmark: ReturnType<typeof resolveDiscoveryBenchmark>;
};

function escapeQueryTerm(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function mapToBenchmark(row: SumblePersonRow | SumbleRelatedPerson): DiscoveryBenchmarkProfile | null {
  const name = row.attributes?.name?.trim();
  const linkedinUrl = row.attributes?.linkedin_url?.trim();
  if (!name || !linkedinUrl) return null;
  return {
    name,
    title: row.attributes?.job_title?.trim() ?? null,
    company: row.attributes?.organization_name?.trim() ?? null,
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

async function fetchPeopleViaFilterQuery(
  query: string,
  limit: number,
): Promise<DiscoveryBenchmarkProfile[]> {
  const res = await sumblePost<SumblePeopleResponse>("/v6/people", {
    filter: { query: { query } },
    limit,
    order_by_column: "job_level",
    order_by_direction: "DESC",
    select: {
      attributes: ["name", "job_title", "linkedin_url", "organization_name"],
    },
  });

  if (!res.ok) return [];

  return dedupeBenchmarks(
    (res.data.people ?? [])
      .map((row) => mapToBenchmark(row))
      .filter((p): p is DiscoveryBenchmarkProfile => Boolean(p)),
  );
}

async function fetchPeopleViaJobsFallback(
  ctx: DiscoveryProfileContext,
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

    const res = await sumblePost<SumbleJobsResponse>("/v6/jobs", {
      filter: { query: { query: `title CONTAINS "${escapeQueryTerm(titleTokens)}"` } },
      limit: 4,
      select: {
        attributes: ["title"],
        related_people: {
          limit: Math.min(limit, 8),
          attributes: ["name", "job_title", "linkedin_url", "organization_name"],
        },
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

  return dedupeBenchmarks(collected).slice(0, limit);
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

  for (const step of buildSumblePeopleQueryLadder(ctx, benchmark)) {
    const batch = await fetchPeopleViaFilterQuery(step.query, cohortSize);
    people = dedupeBenchmarks([...people, ...batch]);
    if (batch.length && !queryUsed) queryUsed = step.query;
    if (people.length >= minAcceptable) break;
  }

  if (people.length < minAcceptable) {
    const fallback = await fetchPeopleViaJobsFallback(ctx, cohortSize);
    people = dedupeBenchmarks([...people, ...fallback]);
  }

  return {
    people: people.slice(0, cohortSize),
    queryUsed,
    benchmark,
  };
}
