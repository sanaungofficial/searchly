import type { NetworkMatchedJob } from "@/lib/network-job-match";
import type { NetworkJobFilterForm } from "@/lib/network-job-filters";
import { createEmptyNetworkJobFilterForm } from "@/lib/network-job-filters";
import { getActingUserScope } from "@/lib/client-session";

const CACHE_PREFIX = "kimchi_network_jobs_v4";

export type NetworkJobsCacheEntry = {
  jobs: NetworkMatchedJob[];
  appliedForm: NetworkJobFilterForm;
  total: number;
  hasMore: boolean;
  page: number;
  needsProfile?: boolean;
  hint?: string | null;
  profileSuggestedLabels?: string[];
  profileForm?: NetworkJobFilterForm;
  fetchedAt: number;
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
    if (!parsed?.fetchedAt || !Array.isArray(parsed.jobs) || !parsed.appliedForm) return null;
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
    sessionStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}

export function defaultNetworkCacheEntry(
  partial: Omit<NetworkJobsCacheEntry, "appliedForm" | "fetchedAt"> & {
    appliedForm?: NetworkJobFilterForm;
    fetchedAt?: number;
  },
): NetworkJobsCacheEntry {
  return {
    appliedForm: partial.appliedForm ?? createEmptyNetworkJobFilterForm(),
    fetchedAt: partial.fetchedAt ?? Date.now(),
    jobs: partial.jobs,
    total: partial.total,
    hasMore: partial.hasMore,
    page: partial.page,
    needsProfile: partial.needsProfile,
    hint: partial.hint,
    profileSuggestedLabels: partial.profileSuggestedLabels,
    profileForm: partial.profileForm,
  };
}
