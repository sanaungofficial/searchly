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
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 30);
  const prioritizedRoles = (profile?.prioritizedRoles ?? []).slice(0, 30);
  const prioritizedCategories = (profile?.prioritizedCategories ?? []).slice(0, 20);
  const deprioritizedRoles = (profile?.deprioritizedRoles ?? []).slice(0, 30);
  const deprioritizedCategories = (profile?.deprioritizedCategories ?? []).slice(0, 20);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const resumeText = profileTextForMatchReasons({
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

  const needsProfile = !hasProfileSignals({
    targetRoles,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText,
    parsedData,
  });

  const enriched = needsProfile
    ? listing
    : enrichNetworkJobWithMatch(listing, resumeText, {
        targetRoles,
        prioritizedRoles,
        prioritizedCategories,
        deprioritizedRoles,
        deprioritizedCategories,
      });

  const job = sanitizeNetworkJobListing(enriched, internalView);

  return NextResponse.json({ job, scored: !needsProfile });
}
