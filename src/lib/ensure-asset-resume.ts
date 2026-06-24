import { prisma } from "@/lib/prisma";
import {
  fetchResumeBytes,
  fileExtFromUrl,
  parseResumeFile,
} from "@/lib/resume-extract";
import { hasResumeBodyContent, normalizeParsedResumeData } from "@/lib/resume-parse";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import type { UserAsset } from "@prisma/client";
import { Prisma } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic && process.env.ANTHROPIC_API_KEY) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

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

/** Ensure a resume asset has parsed text — fetches the file and runs Hirebase/Claude/heuristic parse if needed. */
export async function ensureAssetResumeParsed(
  assetId: string,
  userId: string,
): Promise<UserAsset | null> {
  let asset = await hydrateResumeAsset(assetId, userId);
  if (!asset) return null;

  const parsed = normalizeParsedResumeData(asset.parsedData);
  if (asset.resumeText?.trim() && hasResumeBodyContent(parsed)) {
    return asset;
  }

  if (!asset.url) {
    return asset.resumeText?.trim() ? asset : null;
  }

  const bytes = await fetchResumeBytes(asset.url);
  if (!bytes?.length) {
    return asset.resumeText?.trim() ? asset : null;
  }

  const ext = fileExtFromUrl(asset.url) || "pdf";
  const result = await parseResumeFile(getAnthropic(), bytes, ext, "", asset.name);
  const resumeText = result.text.trim() || asset.resumeText?.trim() || "";
  const nextParsed = result.parsed ?? parsed;

  if (!resumeText) return null;

  asset = await prisma.userAsset.update({
    where: { id: assetId },
    data: {
      resumeText,
      ...(nextParsed
        ? { parsedData: nextParsed as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });

  if (asset.isPrimary) {
    await syncPrimaryResumeToProfile(userId);
  }

  return asset;
}
