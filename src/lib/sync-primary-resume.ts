import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { refreshLinkedInDraftFromAbout } from "@/lib/profile-linkedin-persist";
import { Prisma } from "@prisma/client";

export async function syncPrimaryResumeToProfile(userId: string) {
  const primary = await prisma.userAsset.findFirst({
    where: { userId, type: "RESUME", isPrimary: true },
  });

  if (!primary) return;

  const parsed = normalizeParsedResumeData(primary.parsedData);
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { linkedinUrl: true, resumeUrl: true, resumeText: true },
  });

  const masterContentChanged =
    existing?.resumeUrl !== primary.url ||
    (existing?.resumeText ?? "") !== (primary.resumeText ?? "");
  const linkedinPatch =
    parsed?.linkedinUrl && !existing?.linkedinUrl?.trim()
      ? { linkedinUrl: parsed.linkedinUrl }
      : {};

  await prisma.profile.upsert({
    where: { userId },
    update: {
      resumeUrl: primary.url,
      resumeText: primary.resumeText,
      parsedData: parsed ? (parsed as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      summary: parsed?.summary ?? null,
      ...linkedinPatch,
    },
    create: {
      userId,
      resumeUrl: primary.url,
      resumeText: primary.resumeText ?? undefined,
      parsedData: parsed ?? undefined,
      summary: parsed?.summary ?? undefined,
      linkedinUrl: parsed?.linkedinUrl ?? undefined,
      targetRoles: [],
      priorities: [],
    },
  });

  try {
    await refreshLinkedInDraftFromAbout(userId);
  } catch (err) {
    console.error("[syncPrimaryResumeToProfile linkedin sync]", err);
  }

  // Master resume file/text changed — per-job tailored drafts should be regenerated.
  if (masterContentChanged) {
    await prisma.tailoredResume.deleteMany({ where: { userId } });
  }
}

export function parsedDataSummary(parsed: ParsedResumeData | null): string | null {
  return parsed?.summary ?? null;
}
