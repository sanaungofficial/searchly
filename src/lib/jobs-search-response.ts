import { enrichVectorJobsWithMatchReasons } from "@/lib/hirebase-match-reasons";
import type { RecommendedJobSource } from "@/lib/recommended-jobs-fallback";
import type { RoleTitlePreferences } from "@/lib/role-title-preferences";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

export async function enrichRecommendedSources(
  sources: RecommendedJobSource[],
  resumeText: string,
  options?: { heuristicOnly?: boolean; roleTitlePreferences?: RoleTitlePreferences },
): Promise<VectorMatchedJob[]> {
  if (!sources.length) return [];
  return enrichVectorJobsWithMatchReasons({
    rawJobs: sources.map((s) => s.raw),
    cachedJobs: sources.map((s) => s.cached),
    companyNames: sources.map((s) => s.companyName),
    resumeText,
    heuristicOnly: options?.heuristicOnly !== false,
    roleTitlePreferences: options?.roleTitlePreferences,
  });
}

export type JobsSearchMatchMode = "company_roles" | "semantic_scoped" | "semantic_global" | "resume";
