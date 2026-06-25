/** Server-side filtering and sorting for coach directory queries. */

import type { CoachDirectoryFilters, CoachFeaturedPreset } from "./coach-types";

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
  createdAt: Date;
  avgRating?: number | null;
  reviewCount?: number;
  followerCount?: number;
};

export function parseCoachDirectoryFilters(searchParams: URLSearchParams): CoachDirectoryFilters {
  const sort = searchParams.get("sort");
  const rateMin = searchParams.get("rateMin");
  const rateMax = searchParams.get("rateMax");

  return {
    category: searchParams.get("category") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    firm: searchParams.get("firm") ?? undefined,
    specialty: searchParams.get("specialty") ?? undefined,
    specialization: searchParams.get("specialization") ?? undefined,
    rateMin: rateMin ? Number(rateMin) : undefined,
    rateMax: rateMax ? Number(rateMax) : undefined,
    featuredOnly: searchParams.get("featured") === "1",
    sort:
      sort === "price-low" || sort === "price-high" || sort === "rating" || sort === "newest"
        ? sort
        : "default",
  };
}

export function featuredPresetFilters(preset: CoachFeaturedPreset): Partial<CoachDirectoryFilters> {
  switch (preset) {
    case "popular":
      return { sort: "rating" };
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
    list = list.filter((c) => c.firms.includes(filters.firm!));
  }
  if (filters.specialty) {
    list = list.filter((c) => c.specialties.includes(filters.specialty!));
  }
  if (filters.specialization) {
    list = list.filter((c) => c.clientSpecializations.includes(filters.specialization!));
  }
  if (filters.rateMin != null) {
    list = list.filter((c) => c.hourlyRate != null && c.hourlyRate >= filters.rateMin!);
  }
  if (filters.rateMax != null) {
    list = list.filter((c) => c.hourlyRate != null && c.hourlyRate <= filters.rateMax!);
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

  // Professional preset: filter after fetch when preset=professional
  return list;
}

export function filterProfessionalCoaches<T extends CoachRow>(coaches: T[]): T[] {
  return coaches.filter((c) => c.isProfessionalCoach);
}

export function sortCoaches<T extends CoachRow>(coaches: T[], sort: CoachDirectoryFilters["sort"] = "default"): T[] {
  const list = [...coaches];

  switch (sort) {
    case "price-low":
      return list.sort((a, b) => (a.hourlyRate ?? 9999) - (b.hourlyRate ?? 9999));
    case "price-high":
      return list.sort((a, b) => (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0));
    case "rating":
      return list.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "newest":
      return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    default:
      return list.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        const ratingDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.hourlyRate ?? 9999) - (b.hourlyRate ?? 9999);
      });
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
