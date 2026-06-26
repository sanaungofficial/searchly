import type { NetworkMatchedJob } from "@/lib/network-job-match";
import { getActingUserScope } from "@/lib/client-session";

const CACHE_PREFIX = "kimchi_network_jobs_v2";

export type NetworkJobsCacheEntry = {
  jobs: NetworkMatchedJob[];
  fetchedAt: number;
  needsProfile?: boolean;
  hint?: string | null;
};

function storageKey(): string {
  const scope = typeof window !== "undefined" ? getActingUserScope() : "self";
  return `${CACHE_PREFIX}:${scope}`;
}

export function readNetworkJobsCache(): NetworkJobsCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NetworkJobsCacheEntry;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.jobs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeNetworkJobsCache(entry: NetworkJobsCacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(), JSON.stringify(entry));
  } catch {
    /* quota or private mode */
  }
}

export function clearNetworkJobsCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
