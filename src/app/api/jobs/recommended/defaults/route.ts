import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { profileDerivedSearchFilters, describeActiveFilters } from "@/lib/recommended-filter-utils";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { prisma } from "@/lib/prisma";

/** Default Hirebase search filters derived from profile — for pre-filling the Filters panel. */
export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );

  const filters = profileDerivedSearchFilters({
    profileLocation: parsedData.location ?? null,
    priorities: profile?.priorities ?? [],
    targetSalary: profile?.targetSalary,
    employmentStatus: profile?.employmentStatus,
    jobTimeline: profile?.jobTimeline,
  });

  return NextResponse.json({
    filters,
    labels: describeActiveFilters(filters),
    profileLocation: parsedData.location ?? null,
    priorities: profile?.priorities ?? [],
  });
}
