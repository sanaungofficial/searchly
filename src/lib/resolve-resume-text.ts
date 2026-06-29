import { ensureAssetResumeParsed, hydrateResumeAsset } from "@/lib/ensure-asset-resume";
import {
  buildParsedDataFromProfile,
  profileHasResumeMaterial,
  PROFILE_MASTER_RESUME_URL,
} from "@/lib/master-resume-shared";
import { prisma } from "@/lib/prisma";
import { hasResumeBodyContent, normalizeParsedResumeData, parsedResumeToText } from "@/lib/resume-parse";
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

async function resolveTextFromProfileFallback(
  userId: string,
  asset: UserAsset,
): Promise<string> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profileHasResumeMaterial(profile)) return "";

  const fromProfile = resumeTextFromProfile(profile);
  if (fromProfile) return fromProfile;

  if (asset.url?.startsWith(PROFILE_MASTER_RESUME_URL) || asset.isPrimary) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const parsed = buildParsedDataFromProfile({ profile, user });
    if (hasResumeBodyContent(parsed)) return parsedResumeToText(parsed);
  }

  return "";
}

async function resolveTextFromResumeAsset(asset: UserAsset, userId: string): Promise<string> {
  let hydrated = await hydrateResumeAsset(asset.id, userId);
  let row = hydrated ?? asset;
  let text = resumeTextFromAsset(row);
  if (!text && row.url && !row.url.startsWith("kimchi://")) {
    row = (await ensureAssetResumeParsed(asset.id, userId)) ?? row;
    text = resumeTextFromAsset(row);
  }
  if (!text) {
    row = (await ensureAssetResumeParsed(asset.id, userId)) ?? row;
    text = resumeTextFromAsset(row);
  }
  if (!text) {
    text = await resolveTextFromProfileFallback(userId, row);
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
