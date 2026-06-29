import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, parsedResumeToText } from "@/lib/resume-parse";
import type { Profile, UserAsset } from "@prisma/client";

export function resumeTextFromAsset(asset: Pick<UserAsset, "resumeText" | "parsedData">): string {
  const parsed = normalizeParsedResumeData(asset.parsedData);
  return asset.resumeText?.trim() || (parsed ? parsedResumeToText(parsed) : "");
}

export function resumeTextFromProfile(profile: Pick<Profile, "resumeText" | "parsedData"> | null): string {
  const direct = profile?.resumeText?.trim() ?? "";
  if (direct) return direct;
  const parsed = normalizeParsedResumeData(profile?.parsedData);
  return parsed ? parsedResumeToText(parsed) : "";
}

/** Resolve resume plain text for AI routes — prefers explicit asset, then profile, then primary asset. */
export async function resolveResumeTextForUser(
  userId: string,
  profile: Pick<Profile, "resumeText" | "parsedData"> | null,
  assetId?: string | null,
): Promise<string> {
  if (assetId?.trim()) {
    const asset = await prisma.userAsset.findFirst({
      where: { id: assetId.trim(), userId, type: "RESUME" },
    });
    if (!asset) return "";
    return resumeTextFromAsset(asset);
  }

  const fromProfile = resumeTextFromProfile(profile);
  if (fromProfile) return fromProfile;

  const primary =
    (await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME", isPrimary: true },
    })) ??
    (await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME" },
      orderBy: { updatedAt: "desc" },
    }));

  return primary ? resumeTextFromAsset(primary) : "";
}
