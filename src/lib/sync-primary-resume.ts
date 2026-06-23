import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { Prisma } from "@prisma/client";

export async function syncPrimaryResumeToProfile(userId: string) {
  const primary = await prisma.userAsset.findFirst({
    where: { userId, type: "RESUME", isPrimary: true },
  });

  if (!primary) return;

  const parsed = normalizeParsedResumeData(primary.parsedData);

  await prisma.profile.upsert({
    where: { userId },
    update: {
      resumeUrl: primary.url,
      resumeText: primary.resumeText,
      parsedData: parsed ? (parsed as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      summary: parsed?.summary ?? null,
    },
    create: {
      userId,
      resumeUrl: primary.url,
      resumeText: primary.resumeText ?? undefined,
      parsedData: parsed ?? undefined,
      summary: parsed?.summary ?? undefined,
      targetRoles: [],
      priorities: [],
    },
  });
}

export function parsedDataSummary(parsed: ParsedResumeData | null): string | null {
  return parsed?.summary ?? null;
}
