import type { VectorSearchFilters } from "@/lib/vector-matched-job";

/** Filter dimensions applied client-side after Hirebase fetch — never sent to Hirebase API. */
export const HIREBASE_CLIENT_ONLY_FILTER_KEYS = [
  "locationRadiusMiles",
] as const satisfies readonly (keyof VectorSearchFilters)[];

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function isNonEmptyArray(val: unknown): val is unknown[] {
  return Array.isArray(val) && val.length > 0;
}

/** Drop empty / unset filter fields so Hirebase is not over-constrained. */
export function compactVectorSearchFilters(filters: VectorSearchFilters): VectorSearchFilters {
  const out: VectorSearchFilters = {};

  for (const [key, val] of Object.entries(filters) as [keyof VectorSearchFilters, unknown][]) {
    if (val == null) continue;
    if (typeof val === "boolean") {
      if (val) (out as Record<string, unknown>)[key] = val;
      continue;
    }
    if (typeof val === "number") {
      if (Number.isFinite(val)) (out as Record<string, unknown>)[key] = val;
      continue;
    }
    if (isNonEmptyString(val)) {
      (out as Record<string, unknown>)[key] = val.trim();
      continue;
    }
    if (isNonEmptyArray(val)) {
      (out as Record<string, unknown>)[key] = val;
    }
  }

  return out;
}

/**
 * Avoid stacking redundant Hirebase constraints:
 * - custom job functions → semantic vsearch only (drop taxonomy categories)
 * - explicit job titles → do not also rely on categories for the same intent
 */
export function loosenStackedHirebaseFilters(filters: VectorSearchFilters): VectorSearchFilters {
  const out = { ...filters };
  const customFns = out.customJobFunctions?.map((s) => s.trim()).filter(Boolean) ?? [];

  if (customFns.length) {
    delete out.jobCategories;
  }

  if (out.jobTitles?.length && out.jobCategories?.length) {
    delete out.jobCategories;
  }

  return out;
}

/** Prepare filters for Hirebase API calls — compact, de-stack, strip client-only keys. */
export function sanitizeFiltersForHirebase(filters: VectorSearchFilters): VectorSearchFilters {
  const withoutClientOnly = { ...filters };
  for (const key of HIREBASE_CLIENT_ONLY_FILTER_KEYS) {
    delete withoutClientOnly[key];
  }
  return loosenStackedHirebaseFilters(compactVectorSearchFilters(withoutClientOnly));
}
