/** Server-side filtering and sorting for coach directory queries. */

import { normalizeCompanySlug } from "@/lib/company-catalog";
import type { CoachDirectoryFilters, CoachFeaturedPreset, CoachSpotlightBadge } from "./coach-types";

type CoachRow = {
  id: string;
  slug: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  photoUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  clientSpecializations: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
  isProfessionalCoach: boolean;
  createdAt?: Date | string;
  avgRating?: number | null;
  reviewCount?: number;
  followerCount?: number;
  matchScore?: number;
};

export function parseCoachDirectoryFilters(searchParams: URLSearchParams): CoachDirectoryFilters {
  const sort = searchParams.get("sort");
  const rateMinRaw = searchParams.get("rateMin");
  const rateMaxRaw = searchParams.get("rateMax");
  const rateMinNum = rateMinRaw ? Number(rateMinRaw) : undefined;
  const rateMaxNum = rateMaxRaw ? Number(rateMaxRaw) : undefined;

  return {
    category: searchParams.get("category") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    firm: searchParams.get("firm") ?? undefined,
    specialty: searchParams.get("specialty") ?? undefined,
    specialization: searchParams.get("specialization") ?? undefined,
    rateMin: rateMinNum != null && Number.isFinite(rateMinNum) ? rateMinNum : undefined,
    rateMax: rateMaxNum != null && Number.isFinite(rateMaxNum) ? rateMaxNum : undefined,
    featuredOnly: searchParams.get("featured") === "1",
    professionalOnly: searchParams.get("professional") === "1",
    sort:
      sort === "price-low" || sort === "price-high" || sort === "rating" || sort === "newest" || sort === "match"
        ? sort
        : "default",
  };
}

export function featuredPresetFilters(preset: CoachFeaturedPreset): Partial<CoachDirectoryFilters> {
  switch (preset) {
    case "popular":
      return { sort: "match" };
    case "professional":
      return { sort: "default" };
    case "budget":
      return { rateMax: 99, sort: "price-low" };
    default:
      return {};
  }
}

export function filterCoaches<T extends CoachRow>(coaches: T[], filters: CoachDirectoryFilters): T[] {
  let list = [...coaches];

  if (filters.category) {
    list = list.filter((c) => c.category === filters.category);
  }
  if (filters.featuredOnly) {
    list = list.filter((c) => c.featured);
  }
  if (filters.firm) {
    const firmSlug = normalizeCompanySlug(filters.firm);
    list = list.filter(
      (c) =>
        c.firms.some((f) => normalizeCompanySlug(f) === firmSlug || f === filters.firm) ||
        (c.currentCompany &&
          (normalizeCompanySlug(c.currentCompany) === firmSlug || c.currentCompany === filters.firm)),
    );
  }
  if (filters.specialty) {
    list = list.filter((c) => c.specialties.includes(filters.specialty!));
  }
  if (filters.specialization) {
    list = list.filter((c) => c.clientSpecializations.includes(filters.specialization!));
  }
  if (filters.rateMin != null) {
    list = list.filter((c) => c.hourlyRate == null || c.hourlyRate >= filters.rateMin!);
  }
  if (filters.rateMax != null) {
    list = list.filter((c) => c.hourlyRate == null || c.hourlyRate <= filters.rateMax!);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.headline ?? "").toLowerCase().includes(q) ||
        (c.bio ?? "").toLowerCase().includes(q) ||
        c.firms.some((f) => f.toLowerCase().includes(q)) ||
        c.specialties.some((s) => s.toLowerCase().includes(q)) ||
        (c.location ?? "").toLowerCase().includes(q),
    );
  }

  if (filters.professionalOnly) {
    list = filterProfessionalCoaches(list);
  }

  return list;
}

export function filterProfessionalCoaches<T extends CoachRow>(coaches: T[]): T[] {
  return coaches.filter((c) => c.isProfessionalCoach);
}

export function sortCoaches<T extends CoachRow>(coaches: T[], sort: CoachDirectoryFilters["sort"] = "default"): T[] {
  const list = [...coaches];
  const createdMs = (c: CoachRow) => {
    if (!c.createdAt) return 0;
    return typeof c.createdAt === "string" ? new Date(c.createdAt).getTime() : c.createdAt.getTime();
  };

  switch (sort) {
    case "match":
      return list.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || (b.avgRating ?? 0) - (a.avgRating ?? 0));
    case "price-low":
      return list.sort((a, b) => (a.hourlyRate ?? 9999) - (b.hourlyRate ?? 9999));
    case "price-high":
      return list.sort((a, b) => (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0));
    case "rating":
      return list.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "newest":
      return list.sort((a, b) => createdMs(b) - createdMs(a));
    default:
      return list.sort((a, b) => {
        const matchDiff = (b.matchScore ?? 0) - (a.matchScore ?? 0);
        if (matchDiff !== 0) return matchDiff;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        const ratingDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.hourlyRate ?? 9999) - (b.hourlyRate ?? 9999);
      });
  }
}

const NEW_COACH_DAYS = 45;

function coachAgeDays(createdAt: Date | string): number {
  const ms = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  return (Date.now() - ms) / (1000 * 60 * 60 * 24);
}

function isNewCoach(c: CoachRow): boolean {
  if (!c.createdAt) return false;
  return coachAgeDays(c.createdAt) <= NEW_COACH_DAYS;
}

export function spotlightBadgeForCoach(c: CoachRow): CoachSpotlightBadge | null {
  if (c.featured) return "featured";
  if ((c.avgRating ?? 0) >= 4.8 && (c.reviewCount ?? 0) >= 3) return "top-rated";
  if (isNewCoach(c) && (c.matchScore ?? 0) >= 55) return "rising";
  if (isNewCoach(c)) return "new";
  return null;
}

export const SPOTLIGHT_BADGE_LABELS: Record<CoachSpotlightBadge, string> = {
  featured: "Featured",
  new: "New coach",
  "top-rated": "Top rated",
  rising: "Rising",
};

/** Curated carousel: featured + new + top-rated, always fill to `limit` from best matches. */
export function pickSpotlightCoaches<T extends CoachRow>(coaches: T[], limit = 8): (T & { spotlightBadge: CoachSpotlightBadge | null })[] {
  if (!coaches.length) return [];

  const picked: (T & { spotlightBadge: CoachSpotlightBadge | null })[] = [];
  const seen = new Set<string>();

  const add = (c: T, badge: CoachSpotlightBadge | null) => {
    if (seen.has(c.id) || picked.length >= limit) return;
    seen.add(c.id);
    picked.push({ ...c, spotlightBadge: badge ?? spotlightBadgeForCoach(c) });
  };

  for (const c of coaches.filter((x) => x.featured)) add(c, "featured");
  for (const c of coaches.filter(isNewCoach).sort((a, b) => createdMs(b) - createdMs(a))) add(c, "new");
  for (const c of coaches
    .filter((x) => (x.avgRating ?? 0) >= 4.5 && (x.reviewCount ?? 0) >= 2)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))) add(c, "top-rated");

  const byMatch = [...coaches].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  for (const c of byMatch) add(c, spotlightBadgeForCoach(c));

  return picked.slice(0, limit);

  function createdMs(row: CoachRow) {
    if (!row.createdAt) return 0;
    return typeof row.createdAt === "string" ? new Date(row.createdAt).getTime() : row.createdAt.getTime();
  }
}

export function computeReviewAggregates(
  reviews: { rating: number; knowledge: number; value: number; responsiveness: number; supportiveness: number }[],
) {
  if (!reviews.length) return null;
  const n = reviews.length;
  const sum = reviews.reduce(
    (acc, r) => ({
      rating: acc.rating + r.rating,
      knowledge: acc.knowledge + r.knowledge,
      value: acc.value + r.value,
      responsiveness: acc.responsiveness + r.responsiveness,
      supportiveness: acc.supportiveness + r.supportiveness,
    }),
    { rating: 0, knowledge: 0, value: 0, responsiveness: 0, supportiveness: 0 },
  );
  return {
    avgRating: Math.round((sum.rating / n) * 10) / 10,
    reviewCount: n,
    knowledge: Math.round((sum.knowledge / n) * 10) / 10,
    value: Math.round((sum.value / n) * 10) / 10,
    responsiveness: Math.round((sum.responsiveness / n) * 10) / 10,
    supportiveness: Math.round((sum.supportiveness / n) * 10) / 10,
  };
}

export function bioSnippet(text: string | null, max = 140): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}
