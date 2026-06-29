import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRecommendedCache,
  filtersCacheKey,
  hasDefaultRecommendedFeedLoaded,
  markDefaultRecommendedFeedLoaded,
  migrateRecommendedCacheScope,
  readRecommendedCache,
  resetRecommendedCacheForTests,
  writeRecommendedCache,
} from "@/lib/recommended-jobs-cache";
import { DEFAULT_VECTOR_SEARCH_FILTERS } from "@/lib/vector-matched-job";

const sampleJob = {
  title: "PM",
  companyName: "Acme",
  url: "https://example.com/jobs/1",
  matchScore: 80,
  matchLabel: "Strong",
  matchReasons: ["skills"],
} as const;

function installBrowserGlobals() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
  };
  Object.assign(globalThis, {
    window: {
      location: { search: "" },
    },
    sessionStorage,
  });
  Object.assign(globalThis.window, { sessionStorage, location: { search: "" } });
  return sessionStorage;
}

describe("recommended-jobs-cache", () => {
  beforeEach(() => {
    resetRecommendedCacheForTests();
    installBrowserGlobals();
  });

  afterEach(() => {
    resetRecommendedCacheForTests();
  });

  it("reads from memory after write when sessionStorage is unavailable", () => {
    const filtersKey = filtersCacheKey(DEFAULT_VECTOR_SEARCH_FILTERS);
    const entry = {
      jobs: [sampleJob],
      filtersKey,
      fetchedAt: Date.now(),
    };

    sessionStorage.setItem = () => {
      throw new Error("quota");
    };

    writeRecommendedCache(entry);
    expect(readRecommendedCache(filtersKey)?.jobs).toHaveLength(1);
  });

  it("tracks default feed loaded per scope", () => {
    expect(hasDefaultRecommendedFeedLoaded()).toBe(false);
    markDefaultRecommendedFeedLoaded();
    expect(hasDefaultRecommendedFeedLoaded()).toBe(true);
    clearRecommendedCache();
    expect(hasDefaultRecommendedFeedLoaded()).toBe(false);
  });

  it("migrates cache and loaded flag when acting user scope resolves", () => {
    const filtersKey = filtersCacheKey(DEFAULT_VECTOR_SEARCH_FILTERS);
    const entry = {
      jobs: [sampleJob],
      filtersKey,
      fetchedAt: Date.now(),
    };

    writeRecommendedCache(entry);
    markDefaultRecommendedFeedLoaded();

    migrateRecommendedCacheScope("self", "user-abc");

    Object.assign(globalThis.window, { location: { search: "" } });
    sessionStorage.setItem("kimchi_acting_user_id", "user-abc");

    expect(readRecommendedCache(filtersKey)?.jobs).toHaveLength(1);
    expect(hasDefaultRecommendedFeedLoaded()).toBe(true);
    expect(sessionStorage.getItem(`kimchi_recommended_jobs_v1:self:${filtersKey}`)).toBeNull();
    expect(sessionStorage.getItem(`kimchi_recommended_jobs_v1:user-abc:${filtersKey}`)).toBeTruthy();
  });
});
