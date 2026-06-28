import type { NetworkMatchedJob } from "@/lib/network-job-match";
import { getActingUserScope } from "@/lib/client-session";

const CACHE_PREFIX = "kimchi_pipeline_network_match_v1";

export type PipelineNetworkMatchCacheEntry = {
  jobs: NetworkMatchedJob[];
  fetchedAt: number;
};

function storageKey(): string {
  const scope = typeof window !== "undefined" ? getActingUserScope() : "self";
  return `${CACHE_PREFIX}:${scope}`;
}

export function readPipelineNetworkMatchCache(): PipelineNetworkMatchCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PipelineNetworkMatchCacheEntry;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.jobs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePipelineNetworkMatchCache(entry: PipelineNetworkMatchCacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(), JSON.stringify(entry));
  } catch {
    /* quota or private mode */
  }
}

export function clearPipelineNetworkMatchCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}
