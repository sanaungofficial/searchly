import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { buildProposedLinkedInDraftFromAbout } from "@/lib/linkedin-about-propose";
import {
  applyAboutMergeSections,
  LINKEDIN_ABOUT_MERGE_SECTIONS,
  type LinkedInAboutMergeSection,
} from "@/lib/linkedin-about-merge";
import { aboutProfileFingerprint, withAboutFingerprint } from "@/lib/linkedin-about-fingerprint";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { loadParsedForSync } from "@/lib/profile-linkedin-sync";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

function parseSections(raw: unknown): LinkedInAboutMergeSection[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(LINKEDIN_ABOUT_MERGE_SECTIONS);
  return raw.filter((s): s is LinkedInAboutMergeSection => typeof s === "string" && allowed.has(s));
}

export async function POST(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser } = resolved;

  const body = await request.json().catch(() => ({}));
  const sections = parseSections(body.sections);
  if (!sections.length) {
    return NextResponse.json({ error: "Select at least one section to apply." }, { status: 400 });
  }

  const proposedResult = await buildProposedLinkedInDraftFromAbout(dbUser.id);
  if (!proposedResult) {
    return NextResponse.json(
      {
        error:
          "Upload and parse a resume first — Kimchi needs structured experience in About to build a LinkedIn preview.",
      },
      { status: 422 },
    );
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const currentDraft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);
  const merged = applyAboutMergeSections({
    current: currentDraft,
    proposed: proposedResult.draft,
    sections,
  });

  const parsed = loadParsedForSync(profile?.parsedData);
  const draft = withAboutFingerprint(
    merged,
    aboutProfileFingerprint({
      parsed,
      headline: profile?.headline,
      summary: profile?.summary ?? parsed.summary,
    }),
  );

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      linkedInDraftSourceAssetId: proposedResult.sourceAssetId,
    },
    create: {
      userId: dbUser.id,
      targetRoles: profile?.targetRoles?.length ? profile.targetRoles : [],
      priorities: [],
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      linkedInDraftSourceAssetId: proposedResult.sourceAssetId,
    },
  });

  return NextResponse.json({
    draft,
    provider: proposedResult.provider,
    sourceAssetId: proposedResult.sourceAssetId,
    appliedSections: sections,
    updatedAt: new Date().toISOString(),
  });
}
