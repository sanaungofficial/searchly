import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { coachProfileTextForMatch } from "@/lib/coach-match";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { prisma } from "@/lib/prisma";
import { CoachStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi(req);
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "MATCH");
  if (quotaError) return quotaError;

  const body = await req.json();
  const { coachId } = body as { coachId?: string };
  if (!coachId) {
    return NextResponse.json({ error: "coachId is required" }, { status: 400 });
  }

  const coach = await prisma.coachProfile.findFirst({
    where: { id: coachId, status: CoachStatus.ACTIVE },
    select: {
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
    },
  });

  if (!coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const profile = dbUser.profile ?? (await prisma.profile.findUnique({ where: { userId: dbUser.id } }));
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeSlice = profileTextForMatchReasons({
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
  });

  if (!resumeSlice.trim() && !targetRoles.length) {
    return NextResponse.json(
      { error: "Add target roles or a resume in Profile before requesting AI match explanations." },
      { status: 400 },
    );
  }

  const template = await getPrompt("COACH_MATCH_EXPLAIN");
  const prompt = interpolate(template, {
    resumeSlice: resumeSlice.slice(0, 4000),
    targetRoles: targetRoles.join(", ") || "Not specified",
    priorities: (profile?.priorities ?? []).join(", ") || "Not specified",
    careerMotivation: profile?.careerMotivation?.trim() || "Not specified",
    strategyIntakeNotes: profile?.strategyIntakeNotes?.trim() || "Not specified",
    coachName: coach.displayName,
    coachHeadline: coach.headline ?? coachProfileTextForMatch(coach).slice(0, 500),
    coachBio: (coach.bio ?? "").slice(0, 1500),
    coachSpecialties: coach.specialties.join(", ") || "Not specified",
    coachIndustries: coach.industries.join(", ") || "Not specified",
    coachFirms: coach.firms.join(", ") || "Not specified",
  });

  const { text } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 1024,
    userId: dbUser.id,
    tags: ["feature:coach-match-explain"],
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}
