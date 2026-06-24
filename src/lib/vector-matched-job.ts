import type { CachedJob } from "@/lib/cached-job";

/** Job from Hirebase vector search, enriched with per-job match explanation. */
export type VectorMatchedJob = CachedJob & {
  companyName: string;
  /** 1-based position in Hirebase vsearch results (best match = 1). */
  vectorRank: number;
  /** 0–100 fit score (Claude or heuristic). */
  matchScore: number;
  matchLabel: string;
  /** 2–4 bullets explaining why this role fits the resume. */
  matchReasons: string[];
  matchedSkills: string[];
  gapSkills: string[];
};

export type VectorSearchFilters = {
  limit?: number;
  page?: number;
  companyName?: string;
  companySlug?: string;
  jobTitles?: string[];
  locationTypes?: string[];
  accuracy?: number;
};
