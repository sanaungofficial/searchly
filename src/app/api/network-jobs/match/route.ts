import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { enrichNetworkJobsWithMatch } from "@/lib/network-job-match";
import {
  canViewNetworkJobInternalFromSession,
  sanitizeNetworkJobListing,
} from "@/lib/network-job-access";
import { loadNetworkJobListings } from "@/lib/network-jobs-load";
import { hasProfileSignals } from "@/lib/recommended-jobs-engine";
import { buildProfileVSearchQuery, profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import {
  buildRoleTitlePreferencesFromProfile,
  profileRoleTitlesForMatch,
} from "@/lib/role-title-preferences";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function buildNetworkMatchProfileText(input: {
  headline?: string | null;
  matchRoles: string[];
  careerMotivation?: string | null;
  priorities?: string[];
  resumeText: string;
}): string {
  if (input.resumeText.trim()) return input.resumeText.trim();

  const parts = [
    input.headline?.trim(),
    input.matchRoles.join(", "),
    input.careerMotivation?.trim(),
    ...(input.priorities ?? []).map((p) => p.trim()).filter(Boolean),
  ].filter(Boolean);

  return parts.join("\n").trim();
}

export async function GET(request: Request) {
  const { jobs, source } = await loadNetworkJobListings();
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser, acting } = resolved;
  const internalView = canViewNetworkJobInternalFromSession(
    acting.realDbUser,
    acting.realDbUser?.role === "ADMIN",
    acting.isImpersonating,
  );
  const visibleJobs = internalView ? jobs : jobs.map((job) => sanitizeNetworkJobListing(job, false));

  if (!dbUser) {
    return NextResponse.json({
      jobs: visibleJobs,
      source,
      count: visibleJobs.length,
      scored: false,
    });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const roleTitlePreferences = buildRoleTitlePreferencesFromProfile(profile);
  const matchRoles = profileRoleTitlesForMatch(roleTitlePreferences);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const profileInput = {
    headline: profile?.headline,
    targetRoles: matchRoles,
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
    buildNetworkMatchProfileText({
      headline: profile?.headline,
      matchRoles,
      careerMotivation: profile?.careerMotivation,
      priorities: profile?.priorities ?? [],
      resumeText: "",
    });

  const needsProfile = !hasProfileSignals({
    targetRoles: matchRoles,
    roleTitlePreferences,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText,
    parsedData,
  });

  const matchedJobs = enrichNetworkJobsWithMatch(visibleJobs, resumeText, roleTitlePreferences);

  return NextResponse.json({
    jobs: matchedJobs,
    source,
    count: matchedJobs.length,
    scored: true,
    needsProfile,
    hint: needsProfile
      ? "Add target or prioritized roles, or upload a resume in Profile to unlock match scores for network roles."
      : undefined,
  });
}
