import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import {
  fetchHirebaseCompanyProfile,
  isHirebaseConfigured,
  type HirebaseCompanyProfile,
} from "@/lib/hirebase";
import { enrichmentFromHirebaseProfile } from "@/lib/hirebase-company-sync";
import type { HirebaseCompanyProfileResponse } from "@/lib/hirebase-company-profile";

export type { HirebaseCompanyProfileResponse };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("company")?.trim();
  if (!companyName) {
    return NextResponse.json({ error: "company query param is required" }, { status: 400 });
  }

  const slugHint = searchParams.get("slug")?.trim() || null;
  const website = searchParams.get("website")?.trim() || null;

  if (!isHirebaseConfigured()) {
    const body: HirebaseCompanyProfileResponse = {
      configured: false,
      profile: null,
      enrichment: null,
      error: "Hirebase is not configured on this environment.",
    };
    return NextResponse.json(body);
  }

  try {
    const profile = await fetchHirebaseCompanyProfile({
      companyName,
      slugHint,
      website,
    });
    const body: HirebaseCompanyProfileResponse = {
      configured: true,
      profile,
      enrichment: enrichmentFromHirebaseProfile(profile),
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
