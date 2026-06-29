import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import { mapApifyProfileToParsedData } from "@/lib/apify-linkedin";
import { persistExternalImageToAvatarsBucket } from "@/lib/persist-external-image";
import { prisma } from "@/lib/prisma";
import type { CoachProfile, Prisma } from "@prisma/client";

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
}

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing.map((item) => item.trim()).filter(Boolean));
  for (const item of incoming) {
    const trimmed = item.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

function firstCurrentPosition(raw: ApifyLinkedInProfile) {
  const positions = raw.positions ?? [];
  return positions.find((position) => position.current) ?? positions[0];
}

function formatSchoolEntry(edu: NonNullable<ApifyLinkedInProfile["educations"]>[number]): string | null {
  const parts = [edu.schoolName?.trim(), edu.degreeName?.trim()].filter(Boolean);
  return parts.length ? parts.join(" — ") : null;
}

export type CoachLinkedInImportApplyResult = {
  coach: CoachProfile;
  filledFields: string[];
};

export async function applyLinkedInImportForCoach(input: {
  coach: CoachProfile;
  linkedinUrl: string;
  scraped: ApifyLinkedInProfile;
}): Promise<CoachLinkedInImportApplyResult> {
  const { coach, linkedinUrl, scraped } = input;
  const parsed = mapApifyProfileToParsedData(scraped);
  const filledFields: string[] = [];
  const patch: Prisma.CoachProfileUpdateInput = {};

  const name = parsed.name?.trim();
  if (name && isBlank(coach.displayName)) {
    patch.displayName = name;
    filledFields.push("displayName");
  }

  const headline = scraped.headline?.trim();
  if (headline && isBlank(coach.headline)) {
    patch.headline = headline;
    filledFields.push("headline");
  }

  const summary = parsed.summary?.trim();
  if (summary && isBlank(coach.bio)) {
    patch.bio = summary;
    filledFields.push("bio");
  }
  if (summary && isBlank(coach.aboutMe)) {
    patch.aboutMe = summary;
    filledFields.push("aboutMe");
  }

  const position = firstCurrentPosition(scraped);
  if (position?.title?.trim() && isBlank(coach.currentRole)) {
    patch.currentRole = position.title.trim();
    filledFields.push("currentRole");
  }
  if (position?.companyName?.trim() && isBlank(coach.currentCompany)) {
    patch.currentCompany = position.companyName.trim();
    filledFields.push("currentCompany");
  }

  const location = scraped.locationName?.trim();
  if (location && isBlank(coach.location)) {
    patch.location = location;
    filledFields.push("location");
  }

  if (isBlank(coach.linkedinUrl)) {
    patch.linkedinUrl = linkedinUrl;
    filledFields.push("linkedinUrl");
  }

  if (isBlank(coach.photoUrl) && scraped.picture?.trim()) {
    const photoResult = await persistExternalImageToAvatarsBucket({
      sourceUrl: scraped.picture.trim(),
      storagePath: `coaches/${coach.id}/photo.jpg`,
      existingUrl: coach.photoUrl,
      forceRefresh: true,
    });
    if (photoResult.url) {
      patch.photoUrl = photoResult.url;
      filledFields.push("photoUrl");
    }
  }

  const companies = (scraped.positions ?? [])
    .map((item) => item.companyName?.trim())
    .filter(Boolean) as string[];
  if (companies.length) {
    const merged = mergeUnique(coach.firms ?? [], companies);
    if (merged.length > (coach.firms?.length ?? 0)) {
      patch.firms = merged;
      filledFields.push("firms");
    }
  }

  const schools = (scraped.educations ?? [])
    .map(formatSchoolEntry)
    .filter(Boolean) as string[];
  if (schools.length) {
    const merged = mergeUnique(coach.schools ?? [], schools);
    if (merged.length > (coach.schools?.length ?? 0)) {
      patch.schools = merged;
      filledFields.push("schools");
    }
  }

  if (parsed.skills.length) {
    const merged = mergeUnique(coach.specialties ?? [], parsed.skills);
    if (merged.length > (coach.specialties?.length ?? 0)) {
      patch.specialties = merged;
      filledFields.push("specialties");
    }
  }

  if (Object.keys(patch).length === 0) {
    return { coach, filledFields: [] };
  }

  const updated = await prisma.coachProfile.update({
    where: { id: coach.id },
    data: patch,
  });

  return { coach: updated, filledFields };
}
