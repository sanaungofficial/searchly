import { prisma } from "@/lib/prisma";
import { normalizeLinkedInDraft, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import {
  effectiveLinkedInDraft,
  loadParsedForSync,
  syncLinkedInDraftFromAbout,
  syncParsedFromLinkedInDraft,
} from "@/lib/profile-linkedin-sync";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { Prisma } from "@prisma/client";

export async function refreshLinkedInDraftFromAbout(userId: string): Promise<LinkedInProfileDraft | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!dbUser?.profile) return null;

  const parsed = loadParsedForSync(dbUser.profile.parsedData);
  const storedDraft = normalizeLinkedInDraft(dbUser.profile.linkedInDraft ?? null);
  const targetRoles = (dbUser.profile.targetRoles as string[] | null) ?? [];

  const draft = syncLinkedInDraftFromAbout({
    parsed,
    name: dbUser.name || "You",
    targetRoles,
    headline: dbUser.profile.headline,
    summary: dbUser.profile.summary ?? parsed.summary,
    existingDraft: storedDraft,
    sourceAssetId: dbUser.profile.linkedInDraftSourceAssetId,
  });

  await prisma.profile.update({
    where: { userId },
    data: {
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
  });

  return draft;
}

export async function syncAboutFromLinkedInDraft(userId: string, draft: LinkedInProfileDraft): Promise<void> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!dbUser?.profile) return;

  const existing = loadParsedForSync(dbUser.profile.parsedData);
  const nextParsed = syncParsedFromLinkedInDraft(draft, existing);

  await prisma.profile.update({
    where: { userId },
    data: {
      parsedData: nextParsed as unknown as Prisma.InputJsonValue,
      summary: draft.about.trim() || dbUser.profile.summary,
      headline: draft.headline.trim() || dbUser.profile.headline,
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
  });

  const primary = await prisma.userAsset.findFirst({
    where: { userId, type: "RESUME", isPrimary: true },
  });
  if (primary) {
    await prisma.userAsset.update({
      where: { id: primary.id },
      data: { parsedData: nextParsed as unknown as Prisma.InputJsonValue },
    });
  }
}

export function buildEffectiveLinkedInDraftForUser(input: {
  name: string;
  targetRoles: string[];
  headline?: string | null;
  summary?: string | null;
  parsedData: unknown;
  storedDraft: unknown;
  sourceAssetId?: string | null;
}): LinkedInProfileDraft | null {
  return effectiveLinkedInDraft({
    parsed: normalizeParsedResumeData(input.parsedData),
    name: input.name,
    targetRoles: input.targetRoles,
    headline: input.headline,
    summary: input.summary,
    storedDraft: normalizeLinkedInDraft(input.storedDraft),
    sourceAssetId: input.sourceAssetId,
  });
}
