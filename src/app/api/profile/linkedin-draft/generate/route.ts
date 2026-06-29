import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { buildProposedLinkedInDraftFromAbout } from "@/lib/linkedin-about-propose";
import {
  applyAboutMergeSections,
  LINKEDIN_ABOUT_MERGE_SECTIONS,
} from "@/lib/linkedin-about-merge";
import { aboutProfileFingerprint, withAboutFingerprint } from "@/lib/linkedin-about-fingerprint";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { loadParsedForSync } from "@/lib/profile-linkedin-sync";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/** Legacy full replace — prefer POST /apply-about with explicit sections. */
export async function POST(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser } = resolved;

  const proposedResult = await buildProposedLinkedInDraftFromAbout(dbUser.id);
  if (!proposedResult) {
    return NextResponse.json(
      { error: "Upload and parse a resume first — Kimchi needs structured experience to build your LinkedIn preview." },
      { status: 422 },
    );
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const existingDraft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);
  const draft = withAboutFingerprint(
    applyAboutMergeSections({
      current: existingDraft,
      proposed: proposedResult.draft,
      sections: [...LINKEDIN_ABOUT_MERGE_SECTIONS],
    }),
    aboutProfileFingerprint({
      parsed: loadParsedForSync(profile?.parsedData),
      headline: profile?.headline,
      summary: profile?.summary,
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
    updatedAt: new Date().toISOString(),
  });
}
