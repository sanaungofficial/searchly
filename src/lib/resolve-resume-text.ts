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

async function resolveTextFromResumeAsset(asset: UserAsset, userId: string): Promise<string> {
  let hydrated = await hydrateResumeAsset(asset.id, userId);
  let row = hydrated ?? asset;
  let text = resumeTextFromAsset(row);
  if (!text && row.url && !row.url.startsWith("kimchi://")) {
    row = (await ensureAssetResumeParsed(asset.id, userId)) ?? row;
    text = resumeTextFromAsset(row);
  }
  return text;
}

/** Resolve resume plain text for AI routes — master RESUME UserAsset only (no profile fallback). */
export async function resolveResumeTextForUser(
  userId: string,
  _profile: Pick<Profile, "resumeText" | "parsedData"> | null,
  assetId?: string | null,
): Promise<string> {
  if (assetId?.trim()) {
    const asset = await prisma.userAsset.findFirst({
      where: { id: assetId.trim(), userId, type: "RESUME" },
    });
    if (!asset) return "";
    return resolveTextFromResumeAsset(asset, userId);
  }

  const primary =
    (await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME", isPrimary: true },
    })) ??
    (await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME" },
      orderBy: { updatedAt: "desc" },
    }));

  if (!primary) return "";
  return resolveTextFromResumeAsset(primary, userId);
}
