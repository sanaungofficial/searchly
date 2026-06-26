import { getActingUser } from "@/lib/acting-user";
import { enrichNetworkJobWithMatch } from "@/lib/network-job-match";
import {
  canViewNetworkJobInternalFromSession,
  sanitizeNetworkJobListing,
} from "@/lib/network-job-access";
import { loadNetworkJobListingById } from "@/lib/network-jobs-load";
import { hasProfileSignals } from "@/lib/recommended-jobs-engine";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import {
  buildRoleTitlePreferencesFromProfile,
  profileRoleTitlesForMatch,
} from "@/lib/role-title-preferences";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const externalId = decodeURIComponent(jobId);
  const listing = await loadNetworkJobListingById(externalId);

  if (!listing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  const internalView = canViewNetworkJobInternalFromSession(
    realDbUser,
    realDbUser?.role === "ADMIN",
    isImpersonating
  );

  if (!dbUser) {
    return NextResponse.json({ job: sanitizeNetworkJobListing(listing, internalView) });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const roleTitlePreferences = buildRoleTitlePreferencesFromProfile(profile);
  const matchRoles = profileRoleTitlesForMatch(roleTitlePreferences);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const resumeText = profileTextForMatchReasons({
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
  });

  const needsProfile = !hasProfileSignals({
    targetRoles: matchRoles,
    roleTitlePreferences,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText,
    parsedData,
  });

  const enriched = needsProfile
    ? listing
    : enrichNetworkJobWithMatch(listing, resumeText, roleTitlePreferences);

  const job = sanitizeNetworkJobListing(enriched, internalView);

  return NextResponse.json({ job, scored: !needsProfile });
}
