import { enrichVectorJobsWithMatchReasons } from "@/lib/hirebase-match-reasons";
import type { RecommendedJobSource } from "@/lib/recommended-jobs-fallback";
import type { RoleTitlePreferences } from "@/lib/role-title-preferences";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

export async function enrichRecommendedSources(
  sources: RecommendedJobSource[],
  resumeText: string,
  options?: {
    heuristicOnly?: boolean;
    roleTitlePreferences?: RoleTitlePreferences;
    profileSkills?: string[];
    excludeMatchTerms?: string[];
  },
): Promise<VectorMatchedJob[]> {
  if (!sources.length) return [];
  return enrichVectorJobsWithMatchReasons({
    rawJobs: sources.map((s) => s.raw),
    cachedJobs: sources.map((s) => s.cached),
    companyNames: sources.map((s) => s.companyName),
    resumeText,
    heuristicOnly: options?.heuristicOnly !== false,
    roleTitlePreferences: options?.roleTitlePreferences,
    profileSkills: options?.profileSkills,
    fetchLanes: sources.map((s) => s.fetchLane),
    excludeMatchTerms: options?.excludeMatchTerms,
  });
}

export type JobsSearchMatchMode = "company_roles" | "semantic_scoped" | "semantic_global" | "resume";
