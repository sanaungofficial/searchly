import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getClientCoachingUser } from "@/lib/coach-api";
import { canUserAccessCoach, isCoachAssignedToUser } from "@/lib/coach-client-assignment";
import { requireAdmin } from "@/lib/auth";
import { computeReviewAggregates } from "@/lib/coach-directory";
import { isNylasConfigured } from "@/lib/nylas";
import { listCoachLiveSessions, listCoachPastRecordings, toLiveSessionView } from "@/lib/live-session-db";
import { listPublicCoachResources } from "@/lib/coach-shared-documents";
import { enrichPackages } from "@/lib/coach-pricing";
import { formatCoachAvailabilitySummary } from "@/lib/coach-availability-display";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getClientCoachingUser(_req);
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
      clientWins: true,
      currentRole: true,
      currentCompany: true,
      location: true,
      photoUrl: true,
      linkedinUrl: true,
      calLink: true,
      nylasSchedulerConfigId: true,
      schedulerDurationMinutes: true,
      schedulerTimezone: true,
      schedulerOpenHourStart: true,
      schedulerOpenHourEnd: true,
      schedulerOpenDays: true,
      schedulerWeeklyHours: true,
      schedulerAvailabilityNotes: true,
      introDurationMinutes: true,
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
      requiresAssignment: true,
      experienceLevel: true,
      clientTier: true,
      industryYears: true,
      packagesSyncToHourly: true,
      bulkDiscounts: { where: { enabled: true } },
      pricingPackages: {
        where: { enabled: true, isPublic: true },
        orderBy: { sortOrder: "asc" },
      },
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
  let isMyCoach = false;
  if (me) {
    const follow = await prisma.coachFollow.findUnique({
      where: { userId_coachProfileId: { userId: me.id, coachProfileId: coach.id } },
    });
    isFollowing = Boolean(follow);
    isMyCoach = await isCoachAssignedToUser(coach.id, me.id);
  }

  const aggregates = computeReviewAggregates(allReviews);
  const avgRating = aggregates?.avgRating ?? null;
  const reviewCount = aggregates?.reviewCount ?? 0;

  const [completedBookings, clientsCoachedCount] = await Promise.all([
    prisma.coachBooking.findMany({
      where: {
        coachProfileId: coach.id,
        status: "CONFIRMED",
        endAt: { lt: new Date() },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.coachClientAssignment.count({ where: { coachProfileId: coach.id } }),
  ]);
  const totalCoachedMinutes = completedBookings.reduce(
    (sum, booking) => sum + Math.max(0, Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60_000)),
    0,
  );

  const upcomingLiveRows = await listCoachLiveSessions(coach.id);
  const upcomingLiveSessions = upcomingLiveRows.map((row) =>
    toLiveSessionView(row, { registrationCount: row._count.registrations }),
  );
  const pastRecordingRows = await listCoachPastRecordings(coach.id);
  const pastRecordings = pastRecordingRows.map((row) =>
    toLiveSessionView(row, { registrationCount: row._count.registrations }),
  );
  const publicResources = await listPublicCoachResources(coach.id);
  const availabilityMeta = formatCoachAvailabilitySummary(coach);
  const hasNylasBooking = Boolean(coach.nylasSchedulerConfigId && isNylasConfigured());

  return NextResponse.json({
    id: coach.id,
    slug: coach.slug,
    displayName: coach.displayName,
    headline: coach.headline,
    bio: coach.bio,
    aboutMe: coach.aboutMe,
    whyCoach: coach.whyCoach,
    clientWins: coach.clientWins ?? [],
    currentRole: coach.currentRole,
    currentCompany: coach.currentCompany,
    location: coach.location,
    photoUrl: coach.photoUrl,
    linkedinUrl: coach.linkedinUrl,
    calLink: coach.calLink,
    nylasSchedulerConfigId: coach.nylasSchedulerConfigId,
    schedulerDurationMinutes: coach.schedulerDurationMinutes ?? 60,
    hasNylasBooking,
    bookingAvailability: {
      summary: availabilityMeta.summary,
      timezone: availabilityMeta.timezone,
      availabilityNotes: availabilityMeta.availabilityNotes,
      introDurationMinutes: coach.introDurationMinutes ?? 30,
      sessionDurationMinutes: coach.schedulerDurationMinutes ?? 60,
    },
    firms: coach.firms,
    schools: coach.schools,
    specialties: coach.specialties,
    industries: coach.industries,
    clientSpecializations: coach.clientSpecializations,
    hourlyRate: coach.hourlyRate,
    category: coach.category,
    featured: coach.featured,
    isProfessionalCoach: coach.isProfessionalCoach,
    isInternal: coach.isInternal,
    requiresAssignment: coach.requiresAssignment,
    experienceLevel: coach.experienceLevel,
    clientTier: coach.clientTier,
    industryYears: coach.industryYears,
    totalCoachedMinutes,
    clientsCoachedCount,
    avgRating,
    reviewCount,
    followerCount: coach._count.followers,
    isFollowing,
    isMyCoach,
    aggregates,
    reviews: coach.reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    upcomingLiveSessions,
    pastRecordings,
    publicResources,
    purchasablePackages: enrichPackages(
      coach.pricingPackages,
      coach.hourlyRate,
      coach.bulkDiscounts,
      coach.packagesSyncToHourly,
    ).filter((p) => p.displayPriceCents != null && p.displayPriceCents >= 100),
  });
}
