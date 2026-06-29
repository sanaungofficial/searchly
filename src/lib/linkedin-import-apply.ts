import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import {
  buildResumeTextFromParsed,
  mapApifyProfileToLinkedInDraft,
  mapApifyProfileToParsedData,
} from "@/lib/apify-linkedin";
import {
  applyImportMergeSections,
  diffImportMergeSections,
  LINKEDIN_IMPORT_MERGE_SECTIONS,
  type LinkedInImportMergeDiff,
  type LinkedInImportMergeSection,
} from "@/lib/linkedin-import-merge";
import { normalizeLinkedInDraft, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import {
  resolveLinkedInCoverPhotoImport,
  resolveLinkedInProfilePhotoImport,
} from "@/lib/linkedin-import-photos";
import { refreshLinkedInDraftFromAbout } from "@/lib/profile-linkedin-persist";
import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, reconcileParsedSkillsTools, type ParsedResumeData } from "@/lib/resume-parse";
import { findSupabaseAuthUserIdByEmail } from "@/lib/supabase-admin";
import { Prisma, type Profile, type User } from "@prisma/client";

export type LinkedInImportApplyResult = {
  mergedParsed: ParsedResumeData;
  linkedInDraft: LinkedInProfileDraft;
  finalDraft: LinkedInProfileDraft | null;
  resumeText: string;
  fullName: string | null;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
};

export type LinkedInImportPreviewResult = {
  currentDraft: LinkedInProfileDraft | null;
  proposedDraft: LinkedInProfileDraft;
  incomingParsed: ParsedResumeData;
  diffs: LinkedInImportMergeDiff[];
  fullName: string | null;
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
  sections: Set<LinkedInImportMergeSection>;
}): Promise<{
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  avatarUrl: string | null;
  avatarUrlToPersist: string | null;
}> {
  const profileSource = input.scraped.picture?.trim() || null;
  const coverSource = input.scraped.backgroundCoverImageUrl?.trim() || null;

  const [profileResult, coverResult] = await Promise.all([
    resolveLinkedInProfilePhotoImport({
      sourceUrl: profileSource,
      storagePath: `${input.storageUserId}/linkedin-profile.jpg`,
      existingDraftPhotoUrl: input.existingDraft?.profilePhotoUrl,
      existingUserAvatarUrl: input.existingAvatarUrl,
    }),
    resolveLinkedInCoverPhotoImport({
      sourceUrl: coverSource,
      storagePath: `${input.storageUserId}/linkedin-cover.jpg`,
      existingCoverPhotoUrl: input.existingDraft?.coverPhotoUrl,
      sectionSelected: input.sections.has("coverPhoto"),
    }),
  ]);

  return {
    profilePhotoUrl: profileResult.profilePhotoUrl,
    coverPhotoUrl: coverResult.coverPhotoUrl ?? input.existingDraft?.coverPhotoUrl ?? null,
    avatarUrl: profileResult.avatarUrl,
    avatarUrlToPersist: profileResult.avatarUrlToPersist,
  };
}

function mergeParsedForImportSections(
  existing: ParsedResumeData | null,
  incoming: ParsedResumeData,
  sections: Set<LinkedInImportMergeSection>,
): ParsedResumeData {
  const base = existing ?? incoming;
  return reconcileParsedSkillsTools({
    ...base,
    name: incoming.name?.trim() || base.name || null,
    location: incoming.location?.trim() || base.location || null,
    linkedinUrl: incoming.linkedinUrl?.trim() || base.linkedinUrl || null,
    summary: sections.has("about") ? incoming.summary?.trim() || base.summary || null : base.summary,
    workExperience: sections.has("experience") ? incoming.workExperience : base.workExperience,
    education: sections.has("education") ? incoming.education : base.education,
    skills: sections.has("skills") ? incoming.skills : base.skills,
    tools: sections.has("skills") ? incoming.tools ?? [] : base.tools ?? [],
    skillGroups: sections.has("skills") ? incoming.skillGroups : base.skillGroups,
    certifications: base.certifications,
  });
}

export function buildLinkedInImportPreview(input: {
  dbUser: User;
  profile: Profile | null;
  linkedinUrl: string;
  scraped: ApifyLinkedInProfile;
}): LinkedInImportPreviewResult {
  const { profile, scraped } = input;
  const incomingParsed = mapApifyProfileToParsedData(scraped);
  const existingDraft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);
  const proposedDraft = mapApifyProfileToLinkedInDraft(scraped);
  const fullName = incomingParsed.name?.trim() || null;

  return {
    currentDraft: existingDraft,
    proposedDraft,
    incomingParsed,
    diffs: diffImportMergeSections(existingDraft, proposedDraft),
    fullName,
  };
}

export async function applyLinkedInImportSelection(input: {
  dbUser: User;
  profile: Profile | null;
  linkedinUrl: string;
  scraped: ApifyLinkedInProfile;
  sections: LinkedInImportMergeSection[];
}): Promise<LinkedInImportApplyResult> {
  const { dbUser, profile, linkedinUrl, scraped, sections } = input;
  if (!sections.length) {
    throw new Error("Select at least one section to apply.");
  }

  const selected = new Set(sections);
  const preview = buildLinkedInImportPreview({ dbUser, profile, linkedinUrl, scraped });
  const { incomingParsed, proposedDraft } = preview;
  const existingParsed = normalizeParsedResumeData(profile?.parsedData ?? null);
  const existingDraft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);
  const mergedParsed = mergeParsedForImportSections(existingParsed, incomingParsed, selected);
  const resumeText = buildResumeTextFromParsed(mergedParsed);

  const storageUserId = await resolveStorageUserId(dbUser);
  const photos = await persistLinkedInPhotos({
    scraped,
    storageUserId,
    existingAvatarUrl: dbUser.avatarUrl,
    existingDraft,
    sections: selected,
  });

  let linkedInDraft = applyImportMergeSections({
    current: existingDraft,
    proposed: proposedDraft,
    sections,
  });
  linkedInDraft = {
    ...linkedInDraft,
    profilePhotoUrl: photos.profilePhotoUrl,
    coverPhotoUrl: photos.coverPhotoUrl,
  };

  const fullName = mergedParsed.name?.trim() || null;
  const userUpdate: Prisma.UserUpdateInput = {};
  if (fullName && !dbUser.name?.trim()) userUpdate.name = fullName;
  if (photos.avatarUrlToPersist) {
    userUpdate.avatarUrl = photos.avatarUrlToPersist;
  }
  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id: dbUser.id }, data: userUpdate });
  }

  const profileHeadline = selected.has("headline")
    ? proposedDraft.headline?.trim() || profile?.headline || null
    : profile?.headline || null;
  const profileSummary = selected.has("about")
    ? mergedParsed.summary ?? profile?.summary ?? null
    : profile?.summary ?? null;

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      linkedinUrl,
      headline: profileHeadline,
      summary: profileSummary,
      parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
      resumeText: resumeText || profile?.resumeText || null,
      linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
    create: {
      userId: dbUser.id,
      linkedinUrl,
      headline: profileHeadline,
      summary: profileSummary,
      parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
      resumeText,
      linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      targetRoles: [],
      priorities: [],
    },
  });

  const shouldSyncParsed =
    selected.has("experience") || selected.has("education") || selected.has("skills") || selected.has("about");
  if (shouldSyncParsed) {
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
  }

  const refreshedDraft = selected.has("about") ? await refreshLinkedInDraftFromAbout(dbUser.id) : null;
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

export async function applyLinkedInImportForUser(input: {
  dbUser: User;
  profile: Profile | null;
  linkedinUrl: string;
  scraped: ApifyLinkedInProfile;
}): Promise<LinkedInImportApplyResult> {
  return applyLinkedInImportSelection({
    ...input,
    sections: [...LINKEDIN_IMPORT_MERGE_SECTIONS],
  });
}
