import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { buildProposedLinkedInDraftFromAbout } from "@/lib/linkedin-about-propose";
import { diffAboutMergeSections } from "@/lib/linkedin-about-merge";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser } = resolved;

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
  const diffs = diffAboutMergeSections(currentDraft, proposedResult.draft);

  return NextResponse.json({
    current: currentDraft,
    proposed: proposedResult.draft,
    diffs,
    provider: proposedResult.provider,
    sourceAssetId: proposedResult.sourceAssetId,
  });
}
