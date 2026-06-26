import { enrichCoachesWithMatch } from "@/lib/coach-match";
import { buildCoachMatchUserContext } from "@/lib/coach-match-context";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getClientCoachingUser } from "@/lib/coach-api";

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
  calLink: true,
  linkedinUrl: true,
  createdAt: true,
  _count: { select: { reviews: true, followers: true } },
  reviews: { select: { rating: true } },
} as const;

export async function GET() {
  const me = await getClientCoachingUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const follows = await prisma.coachFollow.findMany({
    where: { userId: me.id },
    select: { coachProfileId: true },
  });
  const followedIds = follows.map((f) => f.coachProfileId);
  if (!followedIds.length) return NextResponse.json([]);

  const coaches = await prisma.coachProfile.findMany({
    where: { id: { in: followedIds }, status: CoachStatus.ACTIVE },
    select: coachListSelect,
  });

  const profile = await prisma.profile.findUnique({ where: { userId: me.id } });
  const matchCtx = await buildCoachMatchUserContext(me.id, profile);

  const base = coaches.map((c) => {
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
      firms: c.firms,
      schools: c.schools,
      specialties: c.specialties,
      industries: c.industries,
      clientSpecializations: c.clientSpecializations,
      hourlyRate: c.hourlyRate,
      category: c.category,
      featured: c.featured,
      isProfessionalCoach: c.isProfessionalCoach,
      calLink: c.calLink,
      linkedinUrl: c.linkedinUrl,
      createdAt: c.createdAt.toISOString(),
      avgRating,
      reviewCount: c._count.reviews,
      followerCount: c._count.followers,
    };
  });

  return NextResponse.json(
    enrichCoachesWithMatch(
      base,
      matchCtx.profileText,
      matchCtx.targetRoles,
      matchCtx.dashboardGoals,
    ),
  );
}
