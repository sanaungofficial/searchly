import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import {
  buildResumeTextFromParsed,
  mapApifyProfileToLinkedInDraft,
  mapApifyProfileToParsedData,
} from "@/lib/apify-linkedin";
import { mergeLinkedInImportParsed } from "@/lib/merge-parsed-data";
import { normalizeLinkedInDraft, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import { persistExternalImageToAvatarsBucket } from "@/lib/persist-external-image";
import { refreshLinkedInDraftFromAbout } from "@/lib/profile-linkedin-persist";
import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { findSupabaseAuthUserIdByEmail } from "@/lib/supabase-admin";
import { Prisma, type Profile, type User } from "@prisma/client";

export type LinkedInImportApplyResult = {
  mergedParsed: ReturnType<typeof mapApifyProfileToParsedData>;
  linkedInDraft: LinkedInProfileDraft;
  finalDraft: LinkedInProfileDraft | null;
  resumeText: string;
  fullName: string | null;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
};

async function resolveStorageUserId(dbUser: User): Promise<string> {
  const authUserId = await findSupabaseAuthUserIdByEmail(dbUser.email);
  return authUserId ?? dbUser.id;
}

async function persistLinkedInPhotos(input: {
  scraped: ApifyLinkedInProfile;
  storageUserId: string;
  existingAvatarUrl?: string | null;
  existingDraft?: LinkedInProfileDraft | null;
}): Promise<{ profilePhotoUrl: string | null; coverPhotoUrl: string | null; avatarUrl: string | null }> {
  const profileSource = input.scraped.picture?.trim() || null;
  const coverSource = input.scraped.backgroundCoverImageUrl?.trim() || null;

  const [profileResult, coverResult] = await Promise.all([
    profileSource
      ? persistExternalImageToAvatarsBucket({
          sourceUrl: profileSource,
          storagePath: `${input.storageUserId}/linkedin-profile.jpg`,
          existingUrl: input.existingDraft?.profilePhotoUrl ?? input.existingAvatarUrl,
          forceRefresh: true,
        })
      : Promise.resolve({ url: input.existingDraft?.profilePhotoUrl ?? input.existingAvatarUrl ?? null }),
    coverSource
      ? persistExternalImageToAvatarsBucket({
          sourceUrl: coverSource,
          storagePath: `${input.storageUserId}/linkedin-cover.jpg`,
          existingUrl: input.existingDraft?.coverPhotoUrl,
          forceRefresh: true,
        })
      : Promise.resolve({ url: input.existingDraft?.coverPhotoUrl ?? null }),
  ]);

  const profilePhotoUrl = profileResult.url;
  const coverPhotoUrl = coverResult.url;
  const avatarUrl = profilePhotoUrl ?? input.existingAvatarUrl ?? null;

  return { profilePhotoUrl, coverPhotoUrl, avatarUrl };
}

export async function applyLinkedInImportForUser(input: {
  dbUser: User;
  profile: Profile | null;
  linkedinUrl: string;
  scraped: ApifyLinkedInProfile;
}): Promise<LinkedInImportApplyResult> {
  const { dbUser, profile, linkedinUrl, scraped } = input;
  const incomingParsed = mapApifyProfileToParsedData(scraped);
  const existingParsed = normalizeParsedResumeData(profile?.parsedData ?? null);
  const mergedParsed = mergeLinkedInImportParsed(existingParsed, incomingParsed);
  const resumeText = buildResumeTextFromParsed(mergedParsed);

  const existingDraft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);
  const storageUserId = await resolveStorageUserId(dbUser);
  const photos = await persistLinkedInPhotos({
    scraped,
    storageUserId,
    existingAvatarUrl: dbUser.avatarUrl,
    existingDraft,
  });

  let linkedInDraft = mapApifyProfileToLinkedInDraft(scraped);
  linkedInDraft = {
    ...linkedInDraft,
    profilePhotoUrl: photos.profilePhotoUrl,
    coverPhotoUrl: photos.coverPhotoUrl,
  };

  const fullName = mergedParsed.name?.trim() || null;
  const userUpdate: Prisma.UserUpdateInput = {};
  if (fullName && !dbUser.name?.trim()) userUpdate.name = fullName;
  if (photos.profilePhotoUrl) {
    userUpdate.avatarUrl = photos.profilePhotoUrl;
  }
  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id: dbUser.id }, data: userUpdate });
  }

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      linkedinUrl,
      headline: scraped.headline?.trim() || profile?.headline || null,
      summary: mergedParsed.summary ?? profile?.summary ?? null,
      parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
      resumeText: resumeText || profile?.resumeText || null,
      linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
    create: {
      userId: dbUser.id,
      linkedinUrl,
      headline: scraped.headline?.trim() || null,
      summary: mergedParsed.summary ?? null,
      parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
      resumeText,
      linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      targetRoles: [],
      priorities: [],
    },
  });

  const primaryAsset = await prisma.userAsset.findFirst({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    orderBy: { createdAt: "desc" },
  });
  if (primaryAsset) {
    await prisma.userAsset.update({
      where: { id: primaryAsset.id },
      data: {
        parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
        resumeText: resumeText || primaryAsset.resumeText,
      },
    });
  }

  const refreshedDraft = await refreshLinkedInDraftFromAbout(dbUser.id);
  const importAt = new Date().toISOString();
  let finalDraft = refreshedDraft ?? normalizeLinkedInDraft(linkedInDraft);
  if (finalDraft) {
    finalDraft = { ...finalDraft, lastLinkedInImportAt: importAt };
    await prisma.profile.update({
      where: { userId: dbUser.id },
      data: { linkedInDraft: finalDraft as unknown as Prisma.InputJsonValue },
    });
  }

  return {
    mergedParsed,
    linkedInDraft,
    finalDraft,
    resumeText,
    fullName,
    avatarUrl: photos.avatarUrl,
    coverPhotoUrl: photos.coverPhotoUrl,
  };
}
