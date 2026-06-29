import { ensureAssetResumeParsed, hydrateResumeAsset } from "@/lib/ensure-asset-resume";
import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, parsedResumeToText } from "@/lib/resume-parse";
import type { Profile, UserAsset } from "@prisma/client";

export function resumeTextFromAsset(asset: Pick<UserAsset, "resumeText" | "parsedData">): string {
  const parsed = normalizeParsedResumeData(asset.parsedData);
  return asset.resumeText?.trim() || (parsed ? parsedResumeToText(parsed) : "");
}

export function resumeTextFromProfile(
  profile: { resumeText?: string | null; parsedData?: unknown } | null,
): string {
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
    const id = assetId.trim();
    let asset = await hydrateResumeAsset(id, userId);
    if (asset) {
      let text = resumeTextFromAsset(asset);
      if (!text && asset.url) {
        asset = (await ensureAssetResumeParsed(id, userId)) ?? asset;
        text = resumeTextFromAsset(asset);
      }
      if (text) return text;
    }
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

  if (!primary) return "";

  const hydrated = await hydrateResumeAsset(primary.id, userId);
  const asset = hydrated ?? primary;
  let text = resumeTextFromAsset(asset);
  if (!text && asset.url) {
    const parsed = await ensureAssetResumeParsed(primary.id, userId);
    if (parsed) text = resumeTextFromAsset(parsed);
  }
  return text;
}
