import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { mergeLinkedInImportParsed } from "@/lib/merge-parsed-data";
import {
  buildResumeTextFromParsed,
  isApifyConfigured,
  mapApifyProfileToLinkedInDraft,
  mapApifyProfileToParsedData,
  scrapeLinkedInProfile,
} from "@/lib/apify-linkedin";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { refreshLinkedInDraftFromAbout } from "@/lib/profile-linkedin-persist";
import { Prisma } from "@prisma/client";
import type { ParsedResumeData } from "@/lib/resume-parse";
import { LINKEDIN_SPARSE_MESSAGE } from "@/lib/user-facing-copy";

function isSparseProfileData(parsed: ParsedResumeData): boolean {
  const hasExperience = (parsed.workExperience?.length ?? 0) > 0;
  const hasSkills = (parsed.skills?.length ?? 0) > 0;
  const hasSummary = !!parsed.summary?.trim();
  const hasEducation = (parsed.education?.length ?? 0) > 0;
  return !hasExperience && !hasSkills && !hasSummary && !hasEducation;
}

export async function POST(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser } = resolved;

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
    const scraped = await scrapeLinkedInProfile(linkedinUrl, { userId: dbUser.id });
    const incomingParsed = mapApifyProfileToParsedData(scraped);
    const existingParsed = normalizeParsedResumeData(profile?.parsedData ?? null);
    const mergedParsed = mergeLinkedInImportParsed(existingParsed, incomingParsed);
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

    const refreshedDraft = await refreshLinkedInDraftFromAbout(dbUser.id);
    const importAt = new Date().toISOString();
    let finalDraft = refreshedDraft ?? normalizeLinkedInDraft(linkedInDraft);
    if (finalDraft) {
      finalDraft = { ...finalDraft, lastLinkedInImportAt: importAt };
      await prisma.profile.update({
        where: { userId: dbUser.id },
        data: { linkedInDraft: finalDraft as unknown as Prisma.InputJsonValue },
      });
    }
    const sparse = isSparseProfileData(mergedParsed);

    return NextResponse.json({
      ok: true,
      sparse,
      sparseMessage: sparse ? LINKEDIN_SPARSE_MESSAGE : undefined,
      linkedinUrl,
      name: fullName ?? dbUser.name,
      headline: scraped.headline ?? null,
      experienceCount: mergedParsed.workExperience.length,
      educationCount: mergedParsed.education.length,
      skillsCount: mergedParsed.skills.length,
      draft: finalDraft,
    });
  } catch (err) {
    console.error("[linkedin-import]", err);
    let message = err instanceof Error ? err.message : "LinkedIn import failed.";
    if (message.startsWith("LINKEDIN_EMPTY:")) {
      message = message.slice("LINKEDIN_EMPTY:".length);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
