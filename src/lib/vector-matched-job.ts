import type { CachedJob } from "@/lib/cached-job";
import type { RecommendedFetchLane } from "@/lib/recommended-jobs-fallback";
import type { JobFitTier } from "@/lib/job-fit-ranking";

export type HirebaseLocationFilter = {
  city?: string;
  region?: string;
  country?: string;
};

/** Optional filters for Hirebase `/v2/jobs/vsearch` summary mode. */
export type VectorSearchFilters = {
  limit?: number;
  page?: number;
  offset?: number;
  accuracy?: number;
  topK?: number;
  minScore?: number;
  /** Free-form text merged into the semantic vsearch query (profile + user focus). */
  semanticQuery?: string;
  /** User-created job functions — merged into vsearch query, not Hirebase keywords. */
  customJobFunctions?: string[];
  companyName?: string;
  companySlug?: string;
  jobTitles?: string[];
  keywords?: string[];
  industries?: string[];
  subindustries?: string[];
  jobCategories?: string[];
  jobTypes?: string[];
  experienceLevels?: string[];
  companySizeBuckets?: string[];
  locationTypes?: string[];
  locations?: HirebaseLocationFilter[];
  /** Relative window — converted to datePostedFrom before Hirebase calls. */
  datePostedWithinDays?: number;
  datePostedFrom?: string;
  /** Max distance from anchor city (profile or filter city). Remote roles always pass. */
  locationRadiusMiles?: number;
  visaSponsored?: boolean;
  salaryFrom?: number;
  salaryTo?: number;
  yearsFrom?: number;
  yearsTo?: number;
  jobSlug?: string;
  jobBoard?: string;
};

export type VectorMatchMeta = {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills: string[];
  gapSkills: string[];
  vectorRank: number;
};

/** Job from Hirebase vector search, enriched with per-job match explanation. */
export type VectorMatchedJob = CachedJob & {
  companyName: string;
  vectorRank: number;
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills: string[];
  gapSkills: string[];
  /** Semantic/heuristic score before role-preference boost/penalty — used to re-rank snapshots. */
  baseMatchScore?: number;
  /** S–E composite fit tier (watchlist × role × skills × source lane). */
  fitTier?: JobFitTier;
  /** Hirebase fetch lane that surfaced this job. */
  fetchLane?: RecommendedFetchLane;
  /** Legacy 1–3 tier for older sort paths — derived from fitTier. */
  rankTier?: 1 | 2 | 3;
  isTrackedCompany?: boolean;
};

export const HIREBASE_LOCATION_TYPES = ["Remote", "Hybrid", "In-Person"] as const;
export const HIREBASE_EXPERIENCE_LEVELS = ["Entry", "Junior", "Mid", "Senior", "Executive"] as const;
export const HIREBASE_JOB_TYPES = ["Full Time", "Part Time", "Contract", "Internship"] as const;
export const HIREBASE_COMPANY_SIZE_BUCKETS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10000+",
] as const;

export const DEFAULT_VECTOR_SEARCH_FILTERS: VectorSearchFilters = {
  limit: 20,
  page: 1,
  accuracy: 0.35,
};

/** Max jobs returned per recommended search (product cap). */
export const VECTOR_SEARCH_RESULTS_MAX = 40;

/** Hirebase `/v2/jobs/search` page size cap per request. */
export const HIREBASE_SEARCH_PAGE_MAX = 40;
