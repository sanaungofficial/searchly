import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";

function splitCsv(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v).trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const items = value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  return undefined;
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseVectorSearchFilters(body: Record<string, unknown>): VectorSearchFilters {
  const limit = num(body.limit);
  return {
    limit: limit != null ? Math.min(Math.max(1, limit), VECTOR_SEARCH_RESULTS_MAX) : undefined,
    page: num(body.page),
    offset: num(body.offset),
    accuracy: num(body.accuracy),
    topK: num(body.topK),
    minScore: num(body.minScore),
    semanticQuery:
      typeof body.semanticQuery === "string"
        ? body.semanticQuery.trim().slice(0, 400) || undefined
        : undefined,
    customJobFunctions: splitCsv(body.customJobFunctions),
    companyName: typeof body.companyName === "string" ? body.companyName : undefined,
    companySlug: typeof body.companySlug === "string" ? body.companySlug : undefined,
    jobSlug: typeof body.jobSlug === "string" ? body.jobSlug : undefined,
    jobBoard: typeof body.jobBoard === "string" ? body.jobBoard : undefined,
    jobTitles: splitCsv(body.jobTitles),
    keywords: splitCsv(body.keywords),
    industries: splitCsv(body.industries),
    subindustries: splitCsv(body.subindustries),
    jobCategories: splitCsv(body.jobCategories),
    jobTypes: splitCsv(body.jobTypes),
    experienceLevels: splitCsv(body.experienceLevels),
    companySizeBuckets: splitCsv(body.companySizeBuckets),
    locationTypes: splitCsv(body.locationTypes),
    locations: (() => {
      if (!Array.isArray(body.locations) || !body.locations.length) return undefined;
      const locs = (body.locations as Array<{ city?: string; region?: string; country?: string }>).filter(
        (loc) => loc.city?.trim() || loc.region?.trim() || loc.country?.trim(),
      );
      return locs.length ? locs : undefined;
    })(),
    datePostedFrom: typeof body.datePostedFrom === "string" ? body.datePostedFrom : undefined,
    datePostedWithinDays: num(body.datePostedWithinDays),
    locationRadiusMiles: num(body.locationRadiusMiles),
    visaSponsored: body.visaSponsored === true,
    salaryFrom: num(body.salaryFrom),
    salaryTo: num(body.salaryTo),
    yearsFrom: num(body.yearsFrom),
    yearsTo: num(body.yearsTo),
  };
}
