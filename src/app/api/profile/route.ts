import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isLinkedInApifyConfigured } from "@/lib/linkedin-apify";
import { scrapeAndMergeLinkedInProfile } from "@/lib/linkedin-scrape-profile";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { after, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });

  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(dbUser?.profile?.parsedData ?? null),
    dbUser?.profile?.readbackData,
  );
  const suggestedLinkedinUrl = parsedData?.linkedinUrl
    ? normalizeLinkedInUrl(parsedData.linkedinUrl)
    : null;

  return NextResponse.json({
    name: dbUser?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "You",
    email: user.email,
    avatarUrl: dbUser?.avatarUrl || null,
    resumeUrl: dbUser?.profile?.resumeUrl || null,
    linkedinUrl: dbUser?.profile?.linkedinUrl || null,
    suggestedLinkedinUrl,
    linkedinScrapeConfigured: isLinkedInApifyConfigured(),
    headline: dbUser?.profile?.headline || null,
    targetRoles: dbUser?.profile?.targetRoles || [],
    parsedData,
    employmentStatus: dbUser?.profile?.employmentStatus || null,
    currentSalary: dbUser?.profile?.currentSalary || null,
    targetSalary: dbUser?.profile?.targetSalary || null,
    careerMotivation: dbUser?.profile?.careerMotivation || null,
    jobTimeline: dbUser?.profile?.jobTimeline || null,
    priorities: dbUser?.profile?.priorities || [],
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, headline, linkedinUrl, targetRoles, parsedData, employmentStatus, currentSalary, targetSalary, priorities, careerMotivation, jobTimeline, attribution } = body;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (name !== undefined) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name } });
  }

  const profileUpdate: Record<string, unknown> = {};
  if (headline !== undefined) profileUpdate.headline = headline;
  if (targetRoles !== undefined) profileUpdate.targetRoles = targetRoles;
  if (parsedData !== undefined) profileUpdate.parsedData = parsedData;
  if (employmentStatus !== undefined) profileUpdate.employmentStatus = employmentStatus;
  if (currentSalary !== undefined) profileUpdate.currentSalary = currentSalary;
  if (targetSalary !== undefined) profileUpdate.targetSalary = targetSalary;
  if (priorities !== undefined) profileUpdate.priorities = priorities;
  if (careerMotivation !== undefined) profileUpdate.careerMotivation = careerMotivation;
  if (jobTimeline !== undefined) profileUpdate.jobTimeline = jobTimeline;
  if (attribution !== undefined) profileUpdate.attribution = attribution;

  let normalizedLinkedIn: string | null = null;
  let shouldScrapeLinkedIn = false;

  if (linkedinUrl !== undefined) {
    if (linkedinUrl === null || linkedinUrl === "") {
      profileUpdate.linkedinUrl = null;
    } else if (typeof linkedinUrl === "string") {
      normalizedLinkedIn = normalizeLinkedInUrl(linkedinUrl);
      if (!normalizedLinkedIn) {
        return NextResponse.json({ error: "Invalid LinkedIn profile URL" }, { status: 400 });
      }
      profileUpdate.linkedinUrl = normalizedLinkedIn;
      shouldScrapeLinkedIn =
        isLinkedInApifyConfigured() && dbUser.profile?.linkedinUrl !== normalizedLinkedIn;
    } else {
      return NextResponse.json({ error: "Invalid linkedinUrl" }, { status: 400 });
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: profileUpdate,
      create: {
        userId: dbUser.id,
        ...profileUpdate,
        targetRoles: (profileUpdate.targetRoles as string[]) || [],
        priorities: (profileUpdate.priorities as string[]) || [],
      },
    });
  }

  if (shouldScrapeLinkedIn && normalizedLinkedIn) {
    const userId = dbUser.id;
    const url = normalizedLinkedIn;
    after(async () => {
      await scrapeAndMergeLinkedInProfile(userId, url).catch(() => {});
    });
  }

  return NextResponse.json({
    ok: true,
    linkedinScrapeStarted: shouldScrapeLinkedIn,
  });
}
