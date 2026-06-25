import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import {
  filterCoaches,
  filterProfessionalCoaches,
  featuredPresetFilters,
  parseCoachDirectoryFilters,
  sortCoaches,
} from "@/lib/coach-directory";
import { slugToCategory } from "@/lib/coach-categories";

const coachListSelect = {
  id: true,
  slug: true,
  displayName: true,
  headline: true,
  bio: true,
  currentRole: true,
  currentCompany: true,
  location: true,
  photoUrl: true,
  firms: true,
  schools: true,
  specialties: true,
  industries: true,
  clientSpecializations: true,
  hourlyRate: true,
  category: true,
  featured: true,
  isProfessionalCoach: true,
  createdAt: true,
  _count: { select: { reviews: true, followers: true } },
  reviews: { select: { rating: true } },
} as const;

async function enrichCoaches(
  coaches: Awaited<ReturnType<typeof prisma.coachProfile.findMany<{ select: typeof coachListSelect }>>>,
) {
  return coaches.map((c) => {
    const avgRating =
      c.reviews.length > 0
        ? Math.round((c.reviews.reduce((s, r) => s + r.rating, 0) / c.reviews.length) * 10) / 10
        : null;
    return {
      id: c.id,
      slug: c.slug,
      displayName: c.displayName,
      headline: c.headline,
      bio: c.bio,
      currentRole: c.currentRole,
      currentCompany: c.currentCompany,
      location: c.location,
      photoUrl: c.photoUrl,
      firms: c.firms,
      schools: c.schools,
      specialties: c.specialties,
      industries: c.industries,
      clientSpecializations: c.clientSpecializations,
      hourlyRate: c.hourlyRate,
      category: c.category,
      featured: c.featured,
      isProfessionalCoach: c.isProfessionalCoach,
      createdAt: c.createdAt,
      avgRating,
      reviewCount: c._count.reviews,
      followerCount: c._count.followers,
    };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const filters = parseCoachDirectoryFilters(searchParams);
  const preset = searchParams.get("preset");
  const categorySlug = searchParams.get("categorySlug");

  if (categorySlug && !filters.category) {
    const cat = slugToCategory(categorySlug);
    if (cat) filters.category = cat;
  }

  if (preset === "professional") {
    /* applied after fetch */
  } else if (preset === "budget") {
    Object.assign(filters, featuredPresetFilters("budget"));
  } else if (preset === "popular") {
    Object.assign(filters, featuredPresetFilters("popular"));
  }

  const coaches = await prisma.coachProfile.findMany({
    where: { status: CoachStatus.ACTIVE },
    select: coachListSelect,
  });

  let enriched = await enrichCoaches(coaches);

  if (preset === "professional") {
    enriched = filterProfessionalCoaches(enriched);
  }

  enriched = filterCoaches(enriched, filters);
  enriched = sortCoaches(enriched, filters.sort);

  const payload = enriched.map(({ createdAt: _c, ...rest }) => rest);

  return NextResponse.json(payload);
}
