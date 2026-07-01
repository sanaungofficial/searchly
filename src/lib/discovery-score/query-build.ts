import { resolveDiscoveryBenchmark, type DiscoveryBenchmarkResolution } from "./benchmark-role";
import type { DiscoveryProfileContext } from "./types";

export type SumbleQueryStep = {
  id: string;
  label: string;
  query: string;
};

function escapeQueryTerm(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function joinAnd(clauses: Array<string | null | undefined>): string | null {
  const parts = clauses.filter(Boolean) as string[];
  if (!parts.length) return null;
  return parts.join(" AND ");
}

function locationClause(ctx: DiscoveryProfileContext): string | null {
  const location = ctx.location?.trim();
  if (!location) return null;
  const term = escapeQueryTerm(location.split(",")[0] ?? location);
  return term ? `location CONTAINS "${term}"` : null;
}

function jobFunctionClause(benchmark: DiscoveryBenchmarkResolution): string | null {
  if (!benchmark.sumbleJobFunction) return null;
  return `job_function EQ "${escapeQueryTerm(benchmark.sumbleJobFunction)}"`;
}

function jobLevelClause(benchmark: DiscoveryBenchmarkResolution): string | null {
  if (!benchmark.sumbleJobLevel) return null;
  return `job_level EQ "${escapeQueryTerm(benchmark.sumbleJobLevel)}"`;
}

function titleClause(benchmark: DiscoveryBenchmarkResolution, field: "job_title" | "title" = "job_title"): string | null {
  const tokens = benchmark.titleTokens;
  if (!tokens.length) return null;
  const parts = tokens
    .map((token) => {
      const term = escapeQueryTerm(token);
      return term ? `${field} CONTAINS "${term}"` : null;
    })
    .filter(Boolean);
  return parts.length ? `(${parts.join(" OR ")})` : null;
}

function technologyClause(ctx: DiscoveryProfileContext): string | null {
  const skills = [...(ctx.parsedData?.skills ?? []), ...(ctx.parsedData?.tools ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (!skills.length) return null;

  const techParts = skills
    .map((skill) => {
      const term = escapeQueryTerm(skill);
      return term ? `technology EQ "${term}"` : null;
    })
    .filter(Boolean);
  return techParts.length ? `(${techParts.join(" OR ")})` : null;
}

/** Progressive Sumble people queries — strictest first, broadest last. */
export function buildSumblePeopleQueryLadder(
  ctx: DiscoveryProfileContext,
  benchmark: DiscoveryBenchmarkResolution = resolveDiscoveryBenchmark(ctx),
): SumbleQueryStep[] {
  const loc = locationClause(ctx);
  const fn = jobFunctionClause(benchmark);
  const lvl = jobLevelClause(benchmark);
  const title = titleClause(benchmark);
  const tech = technologyClause(ctx);

  const steps: Array<SumbleQueryStep | null> = [
    fn && lvl && title && loc
      ? { id: "function_level_title_location", label: "job function, level, title, location", query: joinAnd([fn, lvl, title, loc])! }
      : null,
    fn && lvl && title
      ? { id: "function_level_title", label: "job function, level, and title", query: joinAnd([fn, lvl, title])! }
      : null,
    fn && title && loc
      ? { id: "function_title_location", label: "job function, title, and location", query: joinAnd([fn, title, loc])! }
      : null,
    fn && lvl && loc
      ? { id: "function_level_location", label: "job function, level, and location", query: joinAnd([fn, lvl, loc])! }
      : null,
    fn && title ? { id: "function_title", label: "job function and title", query: joinAnd([fn, title])! } : null,
    fn && lvl ? { id: "function_level", label: "job function and level", query: joinAnd([fn, lvl])! } : null,
    fn && loc ? { id: "function_location", label: "job function and location", query: joinAnd([fn, loc])! } : null,
    fn ? { id: "function_only", label: "job function", query: fn } : null,
    title && loc ? { id: "title_location", label: "title and location", query: joinAnd([title, loc])! } : null,
    title ? { id: "title_only", label: "title keywords", query: title } : null,
    lvl && fn
      ? { id: "level_function", label: "seniority and job function", query: joinAnd([lvl, fn])! }
      : null,
    fn && tech
      ? { id: "function_technology", label: "job function and skills", query: joinAnd([fn, tech])! }
      : null,
  ];

  const seen = new Set<string>();
  const out: SumbleQueryStep[] = [];
  for (const step of steps) {
    if (!step?.query || seen.has(step.query)) continue;
    seen.add(step.query);
    out.push(step);
  }
  return out;
}

/** Job-post queries for global Sumble search (related people on matching postings). */
export function buildSumbleJobsQueryLadder(
  ctx: DiscoveryProfileContext,
  benchmark: DiscoveryBenchmarkResolution = resolveDiscoveryBenchmark(ctx),
): SumbleQueryStep[] {
  const loc = locationClause(ctx);
  const fn = jobFunctionClause(benchmark);
  const lvl = jobLevelClause(benchmark);
  const title = titleClause(benchmark, "title");

  const steps: Array<SumbleQueryStep | null> = [
    fn && lvl && title && loc
      ? { id: "function_level_title_location", label: "job function, level, title, location", query: joinAnd([fn, lvl, title, loc])! }
      : null,
    fn && lvl && title
      ? { id: "function_level_title", label: "job function, level, and title", query: joinAnd([fn, lvl, title])! }
      : null,
    fn && title && loc
      ? { id: "function_title_location", label: "job function, title, and location", query: joinAnd([fn, title, loc])! }
      : null,
    fn && lvl && loc
      ? { id: "function_level_location", label: "job function, level, and location", query: joinAnd([fn, lvl, loc])! }
      : null,
    fn && title ? { id: "function_title", label: "job function and title", query: joinAnd([fn, title])! } : null,
    fn && lvl ? { id: "function_level", label: "job function and level", query: joinAnd([fn, lvl])! } : null,
    fn && loc ? { id: "function_location", label: "job function and location", query: joinAnd([fn, loc])! } : null,
    fn ? { id: "function_only", label: "job function", query: fn } : null,
  ];

  const seen = new Set<string>();
  const out: SumbleQueryStep[] = [];
  for (const step of steps) {
    if (!step?.query || seen.has(step.query)) continue;
    seen.add(step.query);
    out.push(step);
  }
  return out;
}

/** @deprecated Prefer buildSumblePeopleQueryLadder — kept for tests and legacy callers. */
export function buildSumblePeopleQuery(ctx: DiscoveryProfileContext): string | null {
  return buildSumblePeopleQueryLadder(ctx)[0]?.query ?? null;
}

export function buildDiscoverySearchDebug(
  ctx: DiscoveryProfileContext,
  benchmark: DiscoveryBenchmarkResolution = resolveDiscoveryBenchmark(ctx),
) {
  const jobsQueries = buildSumbleJobsQueryLadder(ctx, benchmark).map((step) => step.query);
  const peopleQueries = buildSumblePeopleQueryLadder(ctx, benchmark).map((step) => step.query);
  return {
    targetRole: benchmark.targetRoleLabel,
    peerLabel: benchmark.hirebaseCategory
      ? benchmark.hirebaseCategory.replace(/ Jobs$/i, "")
      : benchmark.sumbleJobFunction ?? benchmark.targetRoleLabel,
    jobFunction: benchmark.sumbleJobFunction,
    queriesTried: [...jobsQueries, ...peopleQueries.map((q) => `org-scoped people: ${q}`)],
  };
}
