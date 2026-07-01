import type { DiscoveryScoreBreakdown, DiscoveryScoreResult } from "@/lib/discovery-score";

export type DiscoveryBenchmarkProfile = {
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string;
  thumbnailUrl: string | null;
};

export type DiscoveryScoreCachePayload = {
  version: 1;
  fingerprint: string;
  refreshedAt: string;
  score: number;
  percentile: number;
  tier: DiscoveryScoreResult["tier"];
  summary: string;
  strengths: string[];
  gaps: string[];
  topImprovement: string;
  breakdown: DiscoveryScoreBreakdown;
  benchmarks: DiscoveryBenchmarkProfile[];
  /** Primary target role from profile (may differ from mapped benchmark). */
  benchmarkTargetRole?: string | null;
  /** Hirebase category or inferred label used for peer cohort. */
  benchmarkPeerLabel?: string | null;
  /** Sumble job_function filter value, when mapped. */
  benchmarkJobFunction?: string | null;
  /** Sumble query that produced the cohort (for support / empty-state copy). */
  benchmarkQuery?: string | null;
};

export type DiscoveryScoreApiResponse = {
  cached: boolean;
  configured: { sumble: boolean; apify: boolean };
  result: DiscoveryScoreCachePayload | null;
  error?: string | null;
  /** Present on failed refresh — what we tried to search. */
  searchDebug?: {
    targetRole: string;
    peerLabel: string;
    jobFunction: string | null;
    queriesTried: string[];
  } | null;
};

export type DiscoveryProfileContext = {
  userId: string;
  name: string;
  headline: string | null;
  summary: string | null;
  targetRoles: string[];
  prioritizedRoles: string[];
  prioritizedCategories: string[];
  /** Parsed-data override — Hirebase job function category for benchmarks. */
  benchmarkCategoryOverride?: string | null;
  location: string | null;
  linkedinUrl: string | null;
  parsedData: {
    skills?: string[];
    tools?: string[];
    workExperience?: Array<{ title?: string; company?: string; from?: string | null; to?: string | null }>;
    education?: Array<{ school?: string; degree?: string }>;
    summary?: string | null;
  } | null;
};

export type EnrichedBenchmark = DiscoveryBenchmarkProfile & {
  skills: string[];
  experienceYears: number;
  experienceEntries: number;
};
