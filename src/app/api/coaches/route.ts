import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/coach-api";
import { getAssignedCoachIds } from "@/lib/coach-client-assignment";
import { enrichCoachesWithMatch } from "@/lib/coach-match";
import { buildCoachMatchUserContext } from "@/lib/coach-match-context";
import { activeCoachListWhere } from "@/lib/coach-list-query";

const coachListSelect = {
  id: true,
  slug: true,
  displayName: true,
  headline: true,
  bio: true,
  aboutMe: true,
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
  isInternal: true,
  calLink: true,
  linkedinUrl: true,
  nylasSchedulerConfigId: true,
  createdAt: true,
  _count: { select: { reviews: true, followers: true } },
  reviews: { select: { rating: true } },
} as const;

function mapCoachRow(c: {
  id: string;
  slug: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  aboutMe: string | null;
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
  isInternal: boolean;
  calLink: string | null;
  linkedinUrl: string | null;
  nylasSchedulerConfigId: string | null;
  createdAt: Date;
  _count: { reviews: number; followers: number };
  reviews: { rating: number }[];
}) {
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
    aboutMe: c.aboutMe,
    currentRole: c.currentRole,
    currentCompany: c.currentCompany,
    location: c.location,
    photoUrl: c.photoUrl,
    firms: c.firms ?? [],
    schools: c.schools ?? [],
    specialties: c.specialties ?? [],
    industries: c.industries ?? [],
    clientSpecializations: c.clientSpecializations ?? [],
    hourlyRate: c.isInternal ? null : c.hourlyRate,
    category: c.category,
    featured: c.featured,
    isProfessionalCoach: c.isProfessionalCoach,
    isInternal: c.isInternal,
    calLink: c.calLink,
    linkedinUrl: c.linkedinUrl,
    nylasSchedulerConfigId: c.nylasSchedulerConfigId,
    hasNylasBooking: Boolean(c.nylasSchedulerConfigId),
    createdAt: c.createdAt.toISOString(),
    avgRating,
    reviewCount: c._count.reviews,
    followerCount: c._count.followers,
  };
}

export async function GET() {
  try {
    const me = await getAuthenticatedDbUser();

    const publicCoaches = await prisma.coachProfile.findMany({
      where: activeCoachListWhere(me?.id),
      select: coachListSelect,
    });

    let assignedInternal: typeof publicCoaches = [];
    if (me) {
      const assignedIds = await getAssignedCoachIds(me.id);
      if (assignedIds.length) {
        assignedInternal = await prisma.coachProfile.findMany({
          where: {
            id: { in: assignedIds },
            status: "ACTIVE",
            isInternal: true,
          },
          select: coachListSelect,
        });
      }
    }

    const mergedMap = new Map<string, typeof publicCoaches[number]>();
    for (const c of publicCoaches) mergedMap.set(c.id, c);
    for (const c of assignedInternal) mergedMap.set(c.id, c);
    const coaches = Array.from(mergedMap.values());

    let matchCtx: Awaited<ReturnType<typeof buildCoachMatchUserContext>> = {
      profileText: "",
      targetRoles: [],
      dashboardGoals: [],
      scored: false,
      hint: null,
    };

    if (me) {
      const profile = await prisma.profile.findUnique({ where: { userId: me.id } });
      matchCtx = await buildCoachMatchUserContext(me.id, profile);
    }

    const base = coaches.map(mapCoachRow);

    const withMatch = enrichCoachesWithMatch(
      base,
      matchCtx.profileText,
      matchCtx.targetRoles,
      matchCtx.dashboardGoals,
    );

    return NextResponse.json({
      coaches: withMatch,
      scored: matchCtx.scored,
      hint: matchCtx.hint,
    });
  } catch (err) {
    console.error("[api/coaches]", err);
    return NextResponse.json({ error: "Failed to load coaches" }, { status: 500 });
  }
}
