import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import {
  profileLocationAllInCountry,
  profileSearchConstraints,
} from "@/lib/profile-search-constraints";
import { describeActiveFilters } from "@/lib/recommended-filter-utils";
import { resolveProfileLocation } from "@/lib/profile-location";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { searchPreferencesFromParsedData } from "@/lib/search-preferences";
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

  const experienceLevel =
    typeof parsedData === "object" &&
    parsedData &&
    "experienceLevel" in parsedData &&
    typeof (parsedData as { experienceLevel?: unknown }).experienceLevel === "string"
      ? (parsedData as { experienceLevel: string }).experienceLevel
      : null;

  const parsedPrefs = searchPreferencesFromParsedData(parsedData);
  const filters = profileSearchConstraints({
    profileLocation: parsedData.location ?? null,
    targetMarket: profile?.targetMarket ?? null,
    priorities: profile?.priorities ?? [],
    experienceLevel,
    targetRoles: profile?.targetRoles ?? [],
    prioritizedCategories: profile?.prioritizedCategories ?? [],
    searchPreferences: parsedPrefs,
  });

  const country = filters.locations?.[0]?.country;
  const searchPreferences = {
    ...parsedPrefs,
    ...(profileLocationAllInCountry(parsedPrefs, country) ? { locationAllInCountry: true } : {}),
  };

  return NextResponse.json({
    filters,
    labels: describeActiveFilters(filters),
    profileLocation,
    priorities: profile?.priorities ?? [],
    targetRoles: profile?.targetRoles ?? [],
    prioritizedCategories: profile?.prioritizedCategories ?? [],
    searchPreferences,
  });
}
