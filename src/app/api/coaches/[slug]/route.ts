import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getAuthenticatedDbUser } from "@/lib/coach-api";
import { canUserAccessCoach } from "@/lib/coach-client-assignment";
import { requireAdmin } from "@/lib/auth";
import { computeReviewAggregates } from "@/lib/coach-directory";
import { isNylasConfigured } from "@/lib/nylas";
import { listCoachLiveSessions, toLiveSessionView } from "@/lib/live-session-db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getAuthenticatedDbUser();
  const admin = await requireAdmin();

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
      schedulerDurationMinutes: true,
      firms: true,
      schools: true,
      specialties: true,
      industries: true,
      clientSpecializations: true,
      hourlyRate: true,
      category: true,
      featured: true,
      isProfessionalCoach: true,
      isInternal: true,
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

  const allowed = await canUserAccessCoach({
    coachProfileId: coach.id,
    userId: me?.id,
    isAdmin: Boolean(admin),
    isInternal: coach.isInternal,
  });
  if (!allowed) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

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

  const upcomingLiveRows = await listCoachLiveSessions(coach.id);
  const upcomingLiveSessions = upcomingLiveRows.map((row) =>
    toLiveSessionView(row, { registrationCount: row._count.registrations }),
  );

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
    schedulerDurationMinutes: coach.schedulerDurationMinutes ?? 60,
    hasNylasBooking: Boolean(coach.nylasSchedulerConfigId && isNylasConfigured()),
    firms: coach.firms,
    schools: coach.schools,
    specialties: coach.specialties,
    industries: coach.industries,
    clientSpecializations: coach.clientSpecializations,
    hourlyRate: coach.isInternal ? null : coach.hourlyRate,
    category: coach.category,
    featured: coach.featured,
    isProfessionalCoach: coach.isProfessionalCoach,
    isInternal: coach.isInternal,
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
    upcomingLiveSessions,
  });
}
