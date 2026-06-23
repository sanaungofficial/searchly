import { prisma } from "@/lib/prisma";
import { hasResumeBodyContent, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { UserAsset } from "@prisma/client";
import { Prisma } from "@prisma/client";

function urlsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.pathname === right.pathname;
  } catch {
    return false;
  }
}

export async function hydrateResumeAsset(assetId: string, userId: string): Promise<UserAsset | null> {
  const asset = await prisma.userAsset.findFirst({
    where: { id: assetId, userId, type: "RESUME" },
  });
  if (!asset) return null;

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return asset;

  const canUseProfile =
    asset.isPrimary ||
    (!!profile.resumeUrl && urlsMatch(asset.url, profile.resumeUrl));

  if (!canUseProfile) return asset;

  const parsed = normalizeParsedResumeData(asset.parsedData);
  const updates: Prisma.UserAssetUpdateInput = {};

  if (!asset.resumeText?.trim() && profile.resumeText?.trim()) {
    updates.resumeText = profile.resumeText;
  }

  if (!hasResumeBodyContent(parsed) && profile.parsedData) {
    const profileParsed = normalizeParsedResumeData(profile.parsedData);
    if (profileParsed && hasResumeBodyContent(profileParsed)) {
      updates.parsedData = profileParsed as unknown as Prisma.InputJsonValue;
    }
  }

  if (Object.keys(updates).length === 0) return asset;

  return prisma.userAsset.update({ where: { id: assetId }, data: updates });
}
