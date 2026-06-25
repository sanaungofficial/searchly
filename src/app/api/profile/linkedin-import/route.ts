import { prisma } from "@/lib/prisma";
import { getActingUser } from "@/lib/acting-user";
import { NextResponse } from "next/server";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { mergeParsedResumeData } from "@/lib/merge-parsed-data";
import {
  buildResumeTextFromParsed,
  isApifyConfigured,
  mapApifyProfileToLinkedInDraft,
  mapApifyProfileToParsedData,
  scrapeLinkedInProfile,
} from "@/lib/apify-linkedin";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  const { authUser, dbUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!isApifyConfigured()) {
    return NextResponse.json({ error: "LinkedIn import is not configured on this environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const linkedinUrl =
    normalizeLinkedInUrl(typeof body.linkedinUrl === "string" ? body.linkedinUrl : "") ||
    normalizeLinkedInUrl(profile?.linkedinUrl ?? "");

  if (!linkedinUrl) {
    return NextResponse.json({ error: "A valid LinkedIn profile URL is required." }, { status: 400 });
  }

  try {
    const scraped = await scrapeLinkedInProfile(linkedinUrl);
    const incomingParsed = mapApifyProfileToParsedData(scraped);
    const existingParsed = normalizeParsedResumeData(profile?.parsedData ?? null);
    const mergedParsed = mergeParsedResumeData(existingParsed, incomingParsed);
    const linkedInDraft = mapApifyProfileToLinkedInDraft(scraped);
    const resumeText = buildResumeTextFromParsed(mergedParsed);

    const fullName = mergedParsed.name?.trim();
    if (fullName && !dbUser.name?.trim()) {
      await prisma.user.update({ where: { id: dbUser.id }, data: { name: fullName } });
    }

    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: {
        linkedinUrl,
        headline: scraped.headline?.trim() || profile?.headline || null,
        summary: mergedParsed.summary ?? profile?.summary ?? null,
        parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
        resumeText: resumeText || profile?.resumeText || null,
        linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
        linkedInDraftUpdatedAt: new Date(),
      },
      create: {
        userId: dbUser.id,
        linkedinUrl,
        headline: scraped.headline?.trim() || null,
        summary: mergedParsed.summary ?? null,
        parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
        resumeText,
        linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
        linkedInDraftUpdatedAt: new Date(),
        targetRoles: [],
        priorities: [],
      },
    });

    const primaryAsset = await prisma.userAsset.findFirst({
      where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
      orderBy: { createdAt: "desc" },
    });
    if (primaryAsset) {
      await prisma.userAsset.update({
        where: { id: primaryAsset.id },
        data: {
          parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
          resumeText: resumeText || primaryAsset.resumeText,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      linkedinUrl,
      name: fullName ?? dbUser.name,
      headline: scraped.headline ?? null,
      experienceCount: mergedParsed.workExperience.length,
      educationCount: mergedParsed.education.length,
      skillsCount: mergedParsed.skills.length,
      draft: normalizeLinkedInDraft(linkedInDraft),
    });
  } catch (err) {
    console.error("[linkedin-import]", err);
    const message = err instanceof Error ? err.message : "LinkedIn import failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
