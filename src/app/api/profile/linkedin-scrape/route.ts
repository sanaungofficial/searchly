import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { scrapeAndMergeLinkedInProfile } from "@/lib/linkedin-scrape-profile";
import { isLinkedInApifyConfigured } from "@/lib/linkedin-apify";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { NextResponse } from "next/server";

async function getAuthedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
  return dbUser?.id ?? null;
}

/** POST /api/profile/linkedin-scrape — scrape LinkedIn via Apify and merge into profile. */
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLinkedInApifyConfigured()) {
    return NextResponse.json(
      { error: "LinkedIn scrape is not configured on this environment" },
      { status: 503 },
    );
  }

  let linkedinUrl: string | undefined;
  try {
    const body = await request.json();
    linkedinUrl = typeof body.linkedinUrl === "string" ? body.linkedinUrl : undefined;
  } catch {
    linkedinUrl = undefined;
  }

  if (!linkedinUrl) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { linkedinUrl: true },
    });
    linkedinUrl = profile?.linkedinUrl ?? undefined;
  }

  if (!linkedinUrl) {
    return NextResponse.json({ error: "linkedinUrl is required" }, { status: 400 });
  }

  const normalized = normalizeLinkedInUrl(linkedinUrl);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid LinkedIn profile URL" }, { status: 400 });
  }

  const result = await scrapeAndMergeLinkedInProfile(userId, normalized);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "LinkedIn scrape failed" }, { status: 502 });
  }

  return NextResponse.json(result);
}
