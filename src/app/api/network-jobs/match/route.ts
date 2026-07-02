import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { enrichNetworkJobsWithMatch, sortNetworkMatchedJobs } from "@/lib/network-job-match";
import {
  canViewNetworkJobInternalFromSession,
  sanitizeNetworkJobListing,
} from "@/lib/network-job-access";
import {
  createEmptyNetworkJobFilterForm,
  type NetworkJobFilterForm,
} from "@/lib/network-job-filters";
import {
  loadNetworkJobListingsPaginated,
  NETWORK_JOBS_PAGE_SIZE,
} from "@/lib/network-jobs-load";
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

function parseFilterFormFromSearchParams(searchParams: URLSearchParams): NetworkJobFilterForm {
  const empty = createEmptyNetworkJobFilterForm();
  const keys = Object.keys(empty) as (keyof NetworkJobFilterForm)[];
  const form = { ...empty };
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value?.trim()) form[key] = value.trim();
  }
  return form;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number(searchParams.get("pageSize") ?? String(NETWORK_JOBS_PAGE_SIZE)) || NETWORK_JOBS_PAGE_SIZE),
  );

  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser, acting } = resolved;
  const internalView = canViewNetworkJobInternalFromSession(
    acting.realDbUser,
    acting.realDbUser?.role === "ADMIN",
    acting.isImpersonating,
  );

  const filterForm = parseFilterFormFromSearchParams(searchParams);
  const paginated = await loadNetworkJobListingsPaginated({
    page,
    pageSize,
    filterForm,
    internalView,
  });

  const visibleJobs = internalView
    ? paginated.jobs
    : paginated.jobs.map((job) => sanitizeNetworkJobListing(job, false));

  if (!dbUser) {
    return NextResponse.json({
      jobs: visibleJobs,
      source: paginated.source,
      count: visibleJobs.length,
      total: paginated.total,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalPages: paginated.totalPages,
      hasMore: paginated.hasMore,
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
    readbackData: profile?.readbackData,
  });

  const matchedJobs = sortNetworkMatchedJobs(
    enrichNetworkJobsWithMatch(visibleJobs, resumeText, roleTitlePreferences),
  );

  return NextResponse.json({
    jobs: matchedJobs,
    source: paginated.source,
    count: matchedJobs.length,
    total: paginated.total,
    page: paginated.page,
    pageSize: paginated.pageSize,
    totalPages: paginated.totalPages,
    hasMore: paginated.hasMore,
    scored: true,
    needsProfile,
    hint: needsProfile
      ? "Add target or prioritized roles, or upload a resume in Profile to unlock match scores for network roles."
      : undefined,
  });
}
