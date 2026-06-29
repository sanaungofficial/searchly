import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { isApifyConfigured, scrapeLinkedInProfile, type ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import { buildLinkedInImportPreview } from "@/lib/linkedin-import-apply";
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
    const preview = buildLinkedInImportPreview({
      dbUser,
      profile,
      linkedinUrl,
      scraped,
    });
    const sparse = isSparseProfileData(preview.incomingParsed);

    return NextResponse.json({
      ok: true,
      preview: true,
      sparse,
      sparseMessage: sparse ? LINKEDIN_SPARSE_MESSAGE : undefined,
      linkedinUrl,
      name: preview.fullName ?? dbUser.name,
      current: preview.currentDraft,
      proposed: preview.proposedDraft,
      diffs: preview.diffs,
      scraped,
      experienceCount: preview.incomingParsed.workExperience.length,
      educationCount: preview.incomingParsed.education.length,
      skillsCount: preview.incomingParsed.skills.length,
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
