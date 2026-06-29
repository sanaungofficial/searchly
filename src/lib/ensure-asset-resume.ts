import { prisma } from "@/lib/prisma";
import {
  buildParsedDataFromProfile,
  profileHasResumeMaterial,
} from "@/lib/master-resume-shared";
import {
  fetchResumeBytes,
  fileExtFromUrl,
  parseResumeFile,
} from "@/lib/resume-extract";
import { hasLegacyAnthropicClient, getLegacyAnthropicClient, isKimchiAiConfigured } from "@/lib/llm";
import { hasResumeBodyContent, normalizeParsedResumeData, parsedResumeToText } from "@/lib/resume-parse";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { createClient } from "@/utils/supabase/server";
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

function storagePathFromAssetUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const signed = pathname.split("/object/sign/resumes/")[1]?.split("?")[0];
    if (signed) return decodeURIComponent(signed);
    const publicPath = pathname.split("/object/public/resumes/")[1]?.split("?")[0];
    if (publicPath) return decodeURIComponent(publicPath);
  } catch {
    return null;
  }
  return null;
}

async function fetchAssetBytes(asset: UserAsset): Promise<Buffer | null> {
  const fromUrl = await fetchResumeBytes(asset.url);
  if (fromUrl?.length) return fromUrl;

  const storagePath = storagePathFromAssetUrl(asset.url);
  if (!storagePath) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("resumes").download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function rebuildKimchiAssetFromProfile(asset: UserAsset, userId: string): Promise<UserAsset | null> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profileHasResumeMaterial(profile)) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const parsed = buildParsedDataFromProfile({ profile, user });
  if (!hasResumeBodyContent(parsed)) return null;

  const resumeText = profile.resumeText?.trim() || parsedResumeToText(parsed);
  if (!resumeText) return null;

  return prisma.userAsset.update({
    where: { id: asset.id },
    data: {
      resumeText,
      parsedData: parsed as unknown as Prisma.InputJsonValue,
      parseStatus: "complete",
      parseCompletedAt: new Date(),
    },
  });
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

  if (!asset.url || asset.url.startsWith("kimchi://")) {
    if (asset.resumeText?.trim() && hasResumeBodyContent(parsed)) return asset;
    const rebuilt = await rebuildKimchiAssetFromProfile(asset, userId);
    if (rebuilt) return rebuilt;
    return asset.resumeText?.trim() ? asset : null;
  }

  const bytes = await fetchAssetBytes(asset);
  if (!bytes?.length) {
    return asset.resumeText?.trim() ? asset : null;
  }

  const ext = fileExtFromUrl(asset.url) || "pdf";
  const anthropic = hasLegacyAnthropicClient() ? getLegacyAnthropicClient() : null;
  if (!anthropic && !isKimchiAiConfigured()) {
    return asset.resumeText?.trim() ? asset : null;
  }

  const result = await parseResumeFile(anthropic, bytes, ext, "", asset.name, userId);
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
