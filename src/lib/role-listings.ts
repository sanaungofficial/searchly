import { jobListingDedupeKey } from "@/lib/cached-job";
import type { CachedJob } from "@/lib/cached-job";
import { jobMatchesListingFilters } from "@/lib/job-listing-filters";
import type { JobMeta } from "@/lib/job-meta";
import type { VectorMatchedJob, VectorSearchFilters } from "@/lib/vector-matched-job";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";

export type RoleListingSource = "recommended" | "pipeline" | "merged";

export type RoleListing = {
  dedupeKey: string;
  source: RoleListingSource;
  title: string;
  companyName: string;
  url: string | null;
  location: string | null;
  cached: CachedJob;
  stage?: KanbanStage;
  pipelineCardId?: number;
  matchScore?: number;
  matchLabel?: string;
  matchReasons?: string[];
  matchedSkills?: string[];
  gapSkills?: string[];
  vectorRank?: number;
  rankTier?: 1 | 2 | 3;
  isTrackedCompany?: boolean;
  fit?: number;
  days?: number;
};

export type StageFilter = "all" | KanbanStage;

function listingDedupeKey(url: string | null | undefined, companyName: string, title: string): string {
  return jobListingDedupeKey({ companyName, title, url });
}

export function kanbanCardToCachedJob(card: KanbanCard): CachedJob {
  const ext = card as KanbanCard & { _url?: string; _meta?: JobMeta };
  const meta = ext._meta;
  return {
    title: card.role,
    location: meta?.location ?? null,
    department: meta?.tags?.[0] ?? null,
    url: ext._url ?? null,
    description: meta?.description ?? null,
    jobSummary: meta?.jobSummary ?? null,
    companySummary: meta?.companySummary ?? null,
    jobType: meta?.jobType ?? null,
    locationType: meta?.locationType ?? null,
    remote: meta?.remote ?? null,
    seniority: meta?.seniority ?? null,
    experienceLevel: meta?.experienceLevel ?? null,
    salary: meta?.salary ?? null,
    skills: meta?.skills,
    tags: meta?.tags,
    benefits: meta?.benefits,
    requiredQualifications: meta?.requiredQualifications,
    datePosted: meta?.datePosted ?? null,
  };
}

export function pipelineCardToRoleListing(card: KanbanCard): RoleListing {
  const ext = card as KanbanCard & { _url?: string; _meta?: JobMeta };
  const cached = kanbanCardToCachedJob(card);
  const vectorMatch = ext._meta?.vectorMatch;

  return {
    dedupeKey: listingDedupeKey(ext._url, card.company, card.role),
    source: "pipeline",
    title: card.role,
    companyName: card.company,
    url: ext._url ?? null,
    location: cached.location ?? null,
    cached,
    stage: card.stage,
    pipelineCardId: card.id,
    matchScore: vectorMatch?.matchScore ?? (card.fit > 0 ? card.fit : undefined),
    matchLabel: vectorMatch?.matchLabel,
    matchReasons: vectorMatch?.matchReasons,
    matchedSkills: vectorMatch?.matchedSkills,
    gapSkills: vectorMatch?.gapSkills,
    vectorRank: vectorMatch?.vectorRank,
    fit: card.fit,
    days: card.days,
  };
}

export function vectorJobToRoleListing(job: VectorMatchedJob): RoleListing {
  return {
    dedupeKey: listingDedupeKey(job.url, job.companyName, job.title),
    source: "recommended",
    title: job.title,
    companyName: job.companyName,
    url: job.url ?? null,
    location: job.location ?? null,
    cached: job,
    matchScore: job.matchScore,
    matchLabel: job.matchLabel,
    matchReasons: job.matchReasons,
    matchedSkills: job.matchedSkills,
    gapSkills: job.gapSkills,
    vectorRank: job.vectorRank,
    rankTier: job.rankTier,
    isTrackedCompany: job.isTrackedCompany,
  };
}

/** Merge recommended API jobs with pipeline cards — one row per URL; pipeline stage wins. */
export function mergeRoleListings(
  recommended: VectorMatchedJob[],
  pipelineCards: KanbanCard[],
): RoleListing[] {
  const byKey = new Map<string, RoleListing>();

  for (const card of pipelineCards) {
    const listing = pipelineCardToRoleListing(card);
    byKey.set(listing.dedupeKey, listing);
  }

  for (const job of recommended) {
    const key = listingDedupeKey(job.url, job.companyName, job.title);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        source: "merged",
        cached: { ...existing.cached, ...job, title: existing.title || job.title },
        matchScore: job.matchScore ?? existing.matchScore,
        matchLabel: job.matchLabel ?? existing.matchLabel,
        matchReasons: job.matchReasons ?? existing.matchReasons,
        matchedSkills: job.matchedSkills ?? existing.matchedSkills,
        gapSkills: job.gapSkills ?? existing.gapSkills,
        vectorRank: job.vectorRank ?? existing.vectorRank,
        location: existing.location ?? job.location ?? null,
      });
    } else {
      byKey.set(key, vectorJobToRoleListing(job));
    }
  }

  const stageOrder: KanbanStage[] = ["saved", "applied", "interview", "offer", "closed"];

  return [...byKey.values()].sort((a, b) => {
    const aPipeline = a.pipelineCardId != null ? 1 : 0;
    const bPipeline = b.pipelineCardId != null ? 1 : 0;
    if (aPipeline !== bPipeline) return bPipeline - aPipeline;
    if (a.stage && b.stage) {
      const sd = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
      if (sd !== 0) return sd;
    }
    const tierA = a.rankTier ?? 3;
    const tierB = b.rankTier ?? 3;
    if (tierA !== tierB) return tierA - tierB;
    const scoreA = a.matchScore ?? 0;
    const scoreB = b.matchScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.title.localeCompare(b.title);
  });
}

export function filterRoleListings(
  listings: RoleListing[],
  filters: VectorSearchFilters,
  stageFilter: StageFilter,
): RoleListing[] {
  let list = listings;

  if (stageFilter !== "all") {
    list = list.filter((row) => row.stage === stageFilter);
  }

  return list.filter((row) => jobMatchesListingFilters(row.cached, row.companyName, filters));
}

export function roleListingToVectorMatchedJob(row: RoleListing): VectorMatchedJob {
  return {
    ...row.cached,
    companyName: row.companyName,
    title: row.title,
    matchScore: row.matchScore ?? 0,
    matchLabel: row.matchLabel ?? "Match",
    matchReasons: row.matchReasons ?? [],
    matchedSkills: row.matchedSkills ?? [],
    gapSkills: row.gapSkills ?? [],
    vectorRank: row.vectorRank ?? 0,
  };
}
