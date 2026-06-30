import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { profileDerivedSearchFilters, describeActiveFilters } from "@/lib/recommended-filter-utils";
import { resolveProfileLocation } from "@/lib/profile-location";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { prisma } from "@/lib/prisma";

/** Default Hirebase search filters derived from profile — for pre-filling the Filters panel. */
export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );

  const profileLocation = resolveProfileLocation({
    parsedLocation: parsedData.location,
    targetMarket: profile?.targetMarket,
  });

  const filters = profileDerivedSearchFilters({
    profileLocation: parsedData.location ?? null,
    targetMarket: profile?.targetMarket ?? null,
    priorities: profile?.priorities ?? [],
    targetSalary: profile?.targetSalary,
    employmentStatus: profile?.employmentStatus,
    jobTimeline: profile?.jobTimeline,
    targetRoles: profile?.targetRoles ?? [],
    prioritizedRoles: profile?.prioritizedRoles ?? [],
    prioritizedCategories: profile?.prioritizedCategories ?? [],
  });

  return NextResponse.json({
    filters,
    labels: describeActiveFilters(filters),
    profileLocation,
    priorities: profile?.priorities ?? [],
    targetRoles: profile?.targetRoles ?? [],
    prioritizedCategories: profile?.prioritizedCategories ?? [],
  });
}
