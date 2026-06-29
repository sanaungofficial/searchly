import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import {
  applyLinkedInImportForUser,
  applyLinkedInImportSelection,
} from "@/lib/linkedin-import-apply";
import {
  LINKEDIN_IMPORT_MERGE_SECTIONS,
  type LinkedInImportMergeSection,
} from "@/lib/linkedin-import-merge";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { isApifyConfigured, type ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import { prisma } from "@/lib/prisma";
import type { ParsedResumeData } from "@/lib/resume-parse";
import { LINKEDIN_SPARSE_MESSAGE } from "@/lib/user-facing-copy";
import { NextResponse } from "next/server";

function parseSections(raw: unknown): LinkedInImportMergeSection[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(LINKEDIN_IMPORT_MERGE_SECTIONS);
  return raw.filter((s): s is LinkedInImportMergeSection => typeof s === "string" && allowed.has(s));
}

function parseScraped(raw: unknown): ApifyLinkedInProfile | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ApifyLinkedInProfile;
}

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

  const applyAll = body.applyAll === true;
  const sections = applyAll ? [...LINKEDIN_IMPORT_MERGE_SECTIONS] : parseSections(body.sections);
  if (!sections.length) {
    return NextResponse.json({ error: "Select at least one section to apply." }, { status: 400 });
  }

  const scraped = parseScraped(body.scraped);
  if (!scraped) {
    return NextResponse.json(
      { error: "Import session expired — fetch from LinkedIn again before applying." },
      { status: 400 },
    );
  }

  try {
    const result = applyAll
      ? await applyLinkedInImportForUser({ dbUser, profile, linkedinUrl, scraped })
      : await applyLinkedInImportSelection({ dbUser, profile, linkedinUrl, scraped, sections });

    const { mergedParsed, finalDraft } = result;
    const sparse = isSparseProfileData(mergedParsed);

    return NextResponse.json({
      ok: true,
      sparse,
      sparseMessage: sparse ? LINKEDIN_SPARSE_MESSAGE : undefined,
      linkedinUrl,
      name: result.fullName ?? dbUser.name,
      headline: result.finalDraft?.headline ?? mergedParsed.summary?.slice(0, 120) ?? null,
      summary: mergedParsed.summary ?? null,
      avatarUrl: result.avatarUrl,
      coverPhotoUrl: result.coverPhotoUrl,
      experienceCount: mergedParsed.workExperience.length,
      educationCount: mergedParsed.education.length,
      skillsCount: mergedParsed.skills.length,
      draft: finalDraft,
      appliedSections: sections,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[linkedin-import/apply]", err);
    const message = err instanceof Error ? err.message : "LinkedIn import apply failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
