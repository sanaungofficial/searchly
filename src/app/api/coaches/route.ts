import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getAuthenticatedDbUser } from "@/lib/coach-api";
import { enrichCoachesWithMatch } from "@/lib/coach-match";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";

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

export async function GET(req: NextRequest) {
  const me = await getAuthenticatedDbUser();

  const coaches = await prisma.coachProfile.findMany({
    where: { status: CoachStatus.ACTIVE },
    select: coachListSelect,
  });

  let profileText = "";
  let targetRoles: string[] = [];

  if (me) {
    const profile = await prisma.profile.findUnique({ where: { userId: me.id } });
    targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
    const parsedData = mergeParsedWithReadback(
      normalizeParsedResumeData(profile?.parsedData ?? null),
      profile?.readbackData,
    );
    profileText =
      profileTextForMatchReasons({
        headline: profile?.headline,
        targetRoles,
        resumeText: profile?.resumeText,
        parsedData,
        careerMotivation: profile?.careerMotivation,
        priorities: profile?.priorities ?? [],
        employmentStatus: profile?.employmentStatus,
        jobTimeline: profile?.jobTimeline,
        targetSalary: profile?.targetSalary
          ? Number.parseFloat(profile.targetSalary.replace(/[^0-9.]/g, "")) || null
          : null,
      }) || "";

    if (!profileText.trim()) {
      const resumeAsset = await findResumeAssetForUser(me.id);
      if (resumeAsset?.resumeText) profileText = resumeAsset.resumeText;
    }
  }

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

  const withMatch = enrichCoachesWithMatch(base, profileText, targetRoles);

  return NextResponse.json({
    coaches: withMatch,
    scored: Boolean(profileText.trim()),
  });
}
