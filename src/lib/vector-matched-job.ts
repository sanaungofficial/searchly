import type { CachedJob } from "@/lib/cached-job";

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
  datePostedFrom?: string;
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
export const VECTOR_SEARCH_RESULTS_MAX = 20;
