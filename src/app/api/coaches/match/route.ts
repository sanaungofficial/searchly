import { getActingUser } from "@/lib/acting-user";
import {
  applyCoachMatchFilters,
  enrichCoachesWithMatch,
  type CoachForMatch,
  type CoachMatchFilters,
} from "@/lib/coach-match";
import { hasProfileSignals } from "@/lib/recommended-jobs-engine";
import { buildProfileVSearchQuery, profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { prisma } from "@/lib/prisma";
import { CoachStatus } from "@prisma/client";
import { NextResponse } from "next/server";

const COACH_SELECT = {
  id: true,
  displayName: true,
  headline: true,
  bio: true,
  currentRole: true,
  currentCompany: true,
  location: true,
  linkedinUrl: true,
  lelandUrl: true,
  photoUrl: true,
  firms: true,
  schools: true,
  specialties: true,
  industries: true,
  hourlyRate: true,
  category: true,
  featured: true,
} as const;

function parseFilters(searchParams: URLSearchParams): CoachMatchFilters {
  const maxHourlyRateRaw = searchParams.get("maxHourlyRate");
  const maxHourlyRate =
    maxHourlyRateRaw != null && maxHourlyRateRaw !== ""
      ? Number.parseFloat(maxHourlyRateRaw)
      : undefined;

  return {
    specialty: searchParams.get("specialty")?.trim() || undefined,
    firm: searchParams.get("firm")?.trim() || undefined,
    industry: searchParams.get("industry")?.trim() || undefined,
    location: searchParams.get("location")?.trim() || undefined,
    maxHourlyRate: Number.isFinite(maxHourlyRate) ? maxHourlyRate : undefined,
  };
}

function buildCoachMatchProfileText(input: {
  headline?: string | null;
  targetRoles: string[];
  careerMotivation?: string | null;
  priorities?: string[];
  resumeText: string;
}): string {
  if (input.resumeText.trim()) return input.resumeText.trim();

  const parts = [
    input.headline?.trim(),
    input.targetRoles.join(", "),
    input.careerMotivation?.trim(),
    ...(input.priorities ?? []).map((p) => p.trim()).filter(Boolean),
  ].filter(Boolean);

  return parts.join("\n").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);

  const coaches = (await prisma.coachProfile.findMany({
    where: { status: CoachStatus.ACTIVE },
    orderBy: [{ featured: "desc" }, { displayName: "asc" }],
    select: COACH_SELECT,
  })) as CoachForMatch[];

  const { dbUser } = await getActingUser(request);

  if (!dbUser) {
    const filtered = applyCoachMatchFilters(
      coaches.map((coach) => ({
        ...coach,
        matchScore: 0,
        matchLabel: "",
        matchReasons: [],
        matchedTags: [],
        gapTags: [],
      })),
      filters,
    );
    return NextResponse.json({
      coaches: filtered,
      scored: false,
      count: filtered.length,
    });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const profileInput = {
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
  };

  const resumeText =
    profileTextForMatchReasons(profileInput) ||
    buildProfileVSearchQuery(profileInput) ||
    buildCoachMatchProfileText({
      headline: profile?.headline,
      targetRoles,
      careerMotivation: profile?.careerMotivation,
      priorities: profile?.priorities ?? [],
      resumeText: "",
    });

  const needsProfile = !hasProfileSignals({
    targetRoles,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText,
    parsedData,
  });

  const matchedCoaches = enrichCoachesWithMatch(coaches, {
    resumeText,
    targetRoles,
    parsedData,
    priorities: profile?.priorities ?? [],
    careerMotivation: profile?.careerMotivation,
    strategyIntakeNotes: profile?.strategyIntakeNotes,
  });

  const filteredCoaches = applyCoachMatchFilters(matchedCoaches, filters);

  return NextResponse.json({
    coaches: filteredCoaches,
    scored: true,
    count: filteredCoaches.length,
    needsProfile,
    hint: needsProfile
      ? "Add target roles or upload a resume in Profile to unlock coach match scores."
      : undefined,
  });
}
