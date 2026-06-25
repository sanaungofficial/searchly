import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getAuthenticatedDbUser } from "@/lib/coach-api";
import { computeReviewAggregates } from "@/lib/coach-directory";
import { isNylasConfigured } from "@/lib/nylas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getAuthenticatedDbUser();

  const coach = await prisma.coachProfile.findFirst({
    where: {
      status: CoachStatus.ACTIVE,
      OR: [{ slug }, { id: slug }],
    },
    select: {
      id: true,
      slug: true,
      displayName: true,
      headline: true,
      bio: true,
      aboutMe: true,
      whyCoach: true,
      currentRole: true,
      currentCompany: true,
      location: true,
      photoUrl: true,
      linkedinUrl: true,
      calLink: true,
      nylasSchedulerConfigId: true,
      firms: true,
      schools: true,
      specialties: true,
      industries: true,
      clientSpecializations: true,
      hourlyRate: true,
      category: true,
      featured: true,
      isProfessionalCoach: true,
      experienceLevel: true,
      clientTier: true,
      industryYears: true,
      _count: { select: { followers: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          authorName: true,
          coachedFor: true,
          rating: true,
          knowledge: true,
          value: true,
          responsiveness: true,
          supportiveness: true,
          message: true,
          createdAt: true,
        },
      },
    },
  });

  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const allReviews = await prisma.coachReview.findMany({
    where: { coachProfileId: coach.id },
    select: { rating: true, knowledge: true, value: true, responsiveness: true, supportiveness: true },
  });

  let isFollowing = false;
  if (me) {
    const follow = await prisma.coachFollow.findUnique({
      where: { userId_coachProfileId: { userId: me.id, coachProfileId: coach.id } },
    });
    isFollowing = Boolean(follow);
  }

  const aggregates = computeReviewAggregates(allReviews);
  const avgRating = aggregates?.avgRating ?? null;
  const reviewCount = aggregates?.reviewCount ?? 0;

  return NextResponse.json({
    id: coach.id,
    slug: coach.slug,
    displayName: coach.displayName,
    headline: coach.headline,
    bio: coach.bio,
    aboutMe: coach.aboutMe,
    whyCoach: coach.whyCoach,
    currentRole: coach.currentRole,
    currentCompany: coach.currentCompany,
    location: coach.location,
    photoUrl: coach.photoUrl,
    linkedinUrl: coach.linkedinUrl,
    calLink: coach.calLink,
    nylasSchedulerConfigId: coach.nylasSchedulerConfigId,
    hasNylasBooking: Boolean(coach.nylasSchedulerConfigId && isNylasConfigured()),
    firms: coach.firms,
    schools: coach.schools,
    specialties: coach.specialties,
    industries: coach.industries,
    clientSpecializations: coach.clientSpecializations,
    hourlyRate: coach.hourlyRate,
    category: coach.category,
    featured: coach.featured,
    isProfessionalCoach: coach.isProfessionalCoach,
    experienceLevel: coach.experienceLevel,
    clientTier: coach.clientTier,
    industryYears: coach.industryYears,
    avgRating,
    reviewCount,
    followerCount: coach._count.followers,
    isFollowing,
    aggregates,
    reviews: coach.reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
