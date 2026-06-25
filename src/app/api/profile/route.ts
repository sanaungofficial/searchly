import { prisma } from "@/lib/prisma";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { normalizeRoleAnalysesMap } from "@/lib/role-gap";
import { normalizeSkillGoals, normalizeUpskillProgress } from "@/lib/upskill-programs";
import { normalizeTargetRoleSettings } from "@/lib/target-role-settings";
import { upsertProfileFields } from "@/lib/profile-write";
import { refreshLinkedInDraftFromAbout } from "@/lib/profile-linkedin-persist";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";

export async function GET() {
  try {
    const { authUser, dbUser, isImpersonating } = await getActingUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });

    const parsedData = mergeParsedWithReadback(
      normalizeParsedResumeData(profile?.parsedData ?? null),
      profile?.readbackData,
    );

    return NextResponse.json({
      userId: dbUser.id,
      name: dbUser.name || authUser.email.split("@")[0] || "You",
      email: dbUser.email,
      avatarUrl: dbUser.avatarUrl || null,
      resumeUrl: profile?.resumeUrl || null,
      linkedinUrl: profile?.linkedinUrl || null,
      headline: profile?.headline || null,
      summary: profile?.summary || null,
      targetRoles: profile?.targetRoles || [],
      parsedData,
      employmentStatus: profile?.employmentStatus || null,
      currentSalary: profile?.currentSalary || null,
      targetSalary: profile?.targetSalary || null,
      careerMotivation: profile?.careerMotivation || null,
      jobTimeline: profile?.jobTimeline || null,
      priorities: profile?.priorities || [],
      roleAnalyses: normalizeRoleAnalysesMap(profile?.roleAnalyses),
      skillGoals: normalizeSkillGoals(profile?.skillGoals),
      upskillProgress: normalizeUpskillProgress(profile?.upskillProgress),
      targetRoleSettings: normalizeTargetRoleSettings(profile?.targetRoleSettings),
      targetMarket: profile?.targetMarket || null,
      relocationOpenness: profile?.relocationOpenness || null,
      workAuthorization: profile?.workAuthorization || null,
      securityClearance: profile?.securityClearance || null,
      searchDuration: profile?.searchDuration || null,
      positioningStatement: profile?.positioningStatement || null,
      strategyIntakeNotes: profile?.strategyIntakeNotes || null,
      strategyUpdatedAt: profile?.strategyUpdatedAt?.toISOString() || null,
      hasStrategy: !!profile?.strategyData,
      impersonating: isImpersonating
        ? { active: true, userId: dbUser.id, name: dbUser.name, email: dbUser.email }
        : undefined,
    });
  } catch (err) {
    console.error("[profile GET]", err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { authUser, dbUser } = await getActingUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await request.json();
  const { name, headline, linkedinUrl, targetRoles, parsedData, employmentStatus, currentSalary, targetSalary, priorities, careerMotivation, jobTimeline, attribution, roleAnalyses, skillGoals, upskillProgress, targetRoleSettings, summary, targetMarket, relocationOpenness, workAuthorization, securityClearance, searchDuration, positioningStatement, strategyIntakeNotes } = body;

  if (name !== undefined) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name } });
  }

  const profileUpdate: Record<string, unknown> = {};
  if (headline !== undefined) profileUpdate.headline = headline;
  if (summary !== undefined) profileUpdate.summary = summary;
  if (linkedinUrl !== undefined) profileUpdate.linkedinUrl = linkedinUrl;
  if (targetRoles !== undefined) profileUpdate.targetRoles = targetRoles;
  if (parsedData !== undefined) profileUpdate.parsedData = parsedData;
  if (employmentStatus !== undefined) profileUpdate.employmentStatus = employmentStatus;
  if (currentSalary !== undefined) profileUpdate.currentSalary = currentSalary;
  if (targetSalary !== undefined) profileUpdate.targetSalary = targetSalary;
  if (priorities !== undefined) profileUpdate.priorities = priorities;
  if (careerMotivation !== undefined) profileUpdate.careerMotivation = careerMotivation;
  if (jobTimeline !== undefined) profileUpdate.jobTimeline = jobTimeline;
  if (attribution !== undefined) profileUpdate.attribution = attribution;
  if (roleAnalyses !== undefined) profileUpdate.roleAnalyses = roleAnalyses;
  if (skillGoals !== undefined) profileUpdate.skillGoals = skillGoals;
  if (upskillProgress !== undefined) profileUpdate.upskillProgress = upskillProgress;
  if (targetRoleSettings !== undefined) profileUpdate.targetRoleSettings = targetRoleSettings;
  if (targetMarket !== undefined) profileUpdate.targetMarket = targetMarket;
  if (relocationOpenness !== undefined) profileUpdate.relocationOpenness = relocationOpenness;
  if (workAuthorization !== undefined) profileUpdate.workAuthorization = workAuthorization;
  if (securityClearance !== undefined) profileUpdate.securityClearance = securityClearance;
  if (searchDuration !== undefined) profileUpdate.searchDuration = searchDuration;
  if (positioningStatement !== undefined) profileUpdate.positioningStatement = positioningStatement;
  if (strategyIntakeNotes !== undefined) profileUpdate.strategyIntakeNotes = strategyIntakeNotes;

  if (Object.keys(profileUpdate).length > 0) {
    await upsertProfileFields(dbUser.id, profileUpdate);
  }

  const shouldSyncLinkedIn =
    parsedData !== undefined ||
    headline !== undefined ||
    summary !== undefined ||
    targetRoles !== undefined;

  if (shouldSyncLinkedIn) {
    try {
      await refreshLinkedInDraftFromAbout(dbUser.id);
    } catch (err) {
      console.error("[profile PATCH linkedin sync]", err);
    }
  }

  return NextResponse.json({ ok: true });
}
