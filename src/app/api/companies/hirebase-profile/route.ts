import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDbUser } from "@/lib/ensure-db-user";
import {
  fetchHirebaseCompanyProfile,
  isHirebaseConfigured,
} from "@/lib/hirebase";
import {
  enrichmentFromHirebaseProfile,
  getHirebaseProfileFromEnrichment,
  persistHirebaseProfileOnTracked,
} from "@/lib/hirebase-company-sync";
import type { HirebaseCompanyProfileResponse } from "@/lib/hirebase-company-profile";

export type { HirebaseCompanyProfileResponse };

export async function GET(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("company")?.trim();
  if (!companyName) {
    return NextResponse.json({ error: "company query param is required" }, { status: 400 });
  }

  const slugHint = searchParams.get("slug")?.trim() || null;
  const website = searchParams.get("website")?.trim() || null;
  const trackedId = searchParams.get("trackedId")?.trim() || null;
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!isHirebaseConfigured()) {
    const body: HirebaseCompanyProfileResponse = {
      configured: false,
      profile: null,
      enrichment: null,
      error: "Hirebase is not configured on this environment.",
    };
    return NextResponse.json(body);
  }

  if (trackedId && !forceRefresh) {
    const tracked = await prisma.trackedCompany.findFirst({
      where: { id: trackedId, userId: dbUser.id },
      include: { companyIntel: true },
    });
    const cachedRaw = tracked?.enrichmentCache ?? tracked?.companyIntel?.enrichmentCache;
    const cachedProfile = getHirebaseProfileFromEnrichment(cachedRaw);
    if (cachedProfile) {
      const body: HirebaseCompanyProfileResponse = {
        configured: true,
        profile: cachedProfile,
        enrichment: enrichmentFromHirebaseProfile(cachedProfile),
        cached: true,
      };
      return NextResponse.json(body);
    }
  }

  try {
    const profile = await fetchHirebaseCompanyProfile({
      companyName,
      slugHint,
      website,
    });
    let enrichment = enrichmentFromHirebaseProfile(profile);
    if (trackedId) {
      enrichment = await persistHirebaseProfileOnTracked(trackedId, dbUser.id, profile);
    }
    const body: HirebaseCompanyProfileResponse = {
      configured: true,
      profile,
      enrichment,
      cached: false,
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't load company profile.";
    const body: HirebaseCompanyProfileResponse = {
      configured: true,
      profile: null,
      enrichment: null,
      error: message,
    };
    return NextResponse.json(body);
  }
}
