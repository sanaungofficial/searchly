import { getActingUser } from "@/lib/acting-user";
import { enrichNetworkJobsWithMatch } from "@/lib/network-job-match";
import { loadNetworkJobListings } from "@/lib/network-jobs-load";
import { hasProfileSignals } from "@/lib/recommended-jobs-engine";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { jobs, source } = await loadNetworkJobListings();
  const { dbUser } = await getActingUser(request);

  if (!dbUser) {
    return NextResponse.json({
      jobs,
      source,
      count: jobs.length,
      scored: false,
    });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
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

  const matchedJobs = enrichNetworkJobsWithMatch(jobs, resumeText, targetRoles);

  return NextResponse.json({
    jobs: matchedJobs,
    source,
    count: matchedJobs.length,
    scored: true,
    needsProfile,
    hint: needsProfile
      ? "Add target roles or upload a resume in Profile to unlock match scores for network roles."
      : undefined,
  });
}
