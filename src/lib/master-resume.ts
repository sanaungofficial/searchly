import { findResumeAssetForUser } from "@/lib/resume-artifact";
import {
  buildParsedDataFromProfile,
  PROFILE_MASTER_RESUME_URL,
  profileHasResumeMaterial,
} from "@/lib/master-resume-shared";
import { prisma } from "@/lib/prisma";
import { parsedResumeToText } from "@/lib/resume-parse";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { Prisma, type UserAsset } from "@prisma/client";

export { PROFILE_MASTER_RESUME_URL, profileHasResumeMaterial, buildParsedDataFromProfile } from "@/lib/master-resume-shared";

export async function getMasterResumeAsset(userId: string, assetId?: string | null): Promise<UserAsset | null> {
  if (assetId?.trim()) {
    return prisma.userAsset.findFirst({
      where: { id: assetId.trim(), userId, type: "RESUME" },
    });
  }
  return findResumeAssetForUser(userId);
}

export async function createMasterResumeFromProfile(userId: string): Promise<UserAsset> {
  const existing = await findResumeAssetForUser(userId);
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profileHasResumeMaterial(profile, user)) {
    throw new Error(
      "Add experience, education, or a summary under Profile before creating a resume.",
    );
  }

  const parsed = buildParsedDataFromProfile({ profile, user });
  const resumeText = profile?.resumeText?.trim() || parsedResumeToText(parsed);
  const firstName = parsed.name?.trim().split(/\s+/)[0];
  const defaultName = firstName ? `${firstName}'s Resume` : "My Resume";

  await prisma.userAsset.updateMany({
    where: { userId, type: "RESUME", isPrimary: true },
    data: { isPrimary: false },
  });

  const asset = await prisma.userAsset.create({
    data: {
      userId,
      type: "RESUME",
      name: defaultName,
      url: PROFILE_MASTER_RESUME_URL,
      isPrimary: true,
      resumeText,
      parsedData: parsed as unknown as Prisma.InputJsonValue,
      parseStatus: "complete",
      parseCompletedAt: new Date(),
    },
  });

  await syncPrimaryResumeToProfile(userId);
  return asset;
}
