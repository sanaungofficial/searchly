import type { CachedJob } from "@/lib/cached-job";
import { getActingUserScope } from "@/lib/client-session";

const CACHE_PREFIX = "kimchi_prospect_job_v1";

export type ProspectJobCacheEntry = {
  prospectId: string;
  job: CachedJob;
  companyName: string | null;
  match?: {
    matchScore: number;
    matchLabel: string;
    matchReasons: string[];
    matchedSkills?: string[];
    gapSkills?: string[];
  };
  fetchedAt: number;
};

function storageKey(prospectId: string): string {
  const scope = typeof window !== "undefined" ? getActingUserScope() : "self";
  return `${CACHE_PREFIX}:${scope}:${prospectId}`;
}

export function readProspectJobCache(prospectId: string): ProspectJobCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(prospectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProspectJobCacheEntry;
    if (!parsed?.fetchedAt || parsed.prospectId !== prospectId || !parsed.job) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProspectJobCache(entry: ProspectJobCacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(entry.prospectId), JSON.stringify(entry));
  } catch {
    /* quota or private mode */
  }
}
