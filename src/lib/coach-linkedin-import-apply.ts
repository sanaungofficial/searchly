import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import {
  buildCoachLinkedInImportPreview,
  type CoachLinkedInImportProposed,
  type CoachLinkedInImportSection,
} from "@/lib/coach-linkedin-import-merge";
import { persistExternalImageToAvatarsBucket } from "@/lib/persist-external-image";
import { prisma } from "@/lib/prisma";
import type { CoachProfile, Prisma } from "@prisma/client";

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing.map((item) => item.trim()).filter(Boolean));
  for (const item of incoming) {
    const trimmed = item.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

function proposedListValue(
  section: "firms" | "schools" | "specialties",
  coach: CoachProfile,
  proposed: CoachLinkedInImportProposed,
): string[] {
  const incoming = proposed[section];
  if (!incoming.length) return coach[section] ?? [];
  return mergeUnique(coach[section] ?? [], incoming);
}

export type CoachLinkedInImportApplyResult = {
  coach: CoachProfile;
  appliedFields: string[];
};

export { buildCoachLinkedInImportPreview } from "@/lib/coach-linkedin-import-merge";

export async function applyLinkedInImportForCoach(input: {
  coach: CoachProfile;
  linkedinUrl: string;
  scraped: ApifyLinkedInProfile;
  sections?: CoachLinkedInImportSection[];
}): Promise<CoachLinkedInImportApplyResult> {
  const { coach, linkedinUrl, scraped, sections } = input;
  const preview = buildCoachLinkedInImportPreview({ coach, scraped, linkedinUrl });
  const { proposed } = preview;
  const selected = new Set(sections ?? []);
  const appliedFields: string[] = [];
  const patch: Prisma.CoachProfileUpdateInput = {};

  if (selected.has("displayName") && proposed.displayName) {
    patch.displayName = proposed.displayName;
    appliedFields.push("displayName");
  }
  if (selected.has("headline") && proposed.headline) {
    patch.headline = proposed.headline;
    appliedFields.push("headline");
  }
  if (selected.has("bio") && proposed.bio) {
    patch.bio = proposed.bio;
    appliedFields.push("bio");
  }
  if (selected.has("aboutMe") && proposed.aboutMe) {
    patch.aboutMe = proposed.aboutMe;
    appliedFields.push("aboutMe");
  }
  if (selected.has("currentRole") && proposed.currentRole) {
    patch.currentRole = proposed.currentRole;
    appliedFields.push("currentRole");
  }
  if (selected.has("currentCompany") && proposed.currentCompany) {
    patch.currentCompany = proposed.currentCompany;
    appliedFields.push("currentCompany");
  }
  if (selected.has("location") && proposed.location) {
    patch.location = proposed.location;
    appliedFields.push("location");
  }
  if (selected.has("linkedinUrl") && proposed.linkedinUrl) {
    patch.linkedinUrl = proposed.linkedinUrl;
    appliedFields.push("linkedinUrl");
  }

  let importedPhotoUrl: string | null = null;

  if (proposed.photoSourceUrl && !coach.photoUrl?.trim()) {
    const photoResult = await persistExternalImageToAvatarsBucket({
      sourceUrl: proposed.photoSourceUrl,
      storagePath: `coaches/${coach.id}/photo.jpg`,
      existingUrl: null,
    });
    if (photoResult.url) {
      importedPhotoUrl = photoResult.url;
      patch.photoUrl = importedPhotoUrl;
      appliedFields.push("photoUrl");
    }
  }

  if (selected.has("firms")) {
    const merged = proposedListValue("firms", coach, proposed);
    if (JSON.stringify(merged) !== JSON.stringify(coach.firms ?? [])) {
      patch.firms = merged;
      appliedFields.push("firms");
    }
  }
  if (selected.has("schools")) {
    const merged = proposedListValue("schools", coach, proposed);
    if (JSON.stringify(merged) !== JSON.stringify(coach.schools ?? [])) {
      patch.schools = merged;
      appliedFields.push("schools");
    }
  }
  if (selected.has("specialties")) {
    const merged = proposedListValue("specialties", coach, proposed);
    if (JSON.stringify(merged) !== JSON.stringify(coach.specialties ?? [])) {
      patch.specialties = merged;
      appliedFields.push("specialties");
    }
  }

  if (Object.keys(patch).length === 0) {
    return { coach, appliedFields: [] };
  }

  const updated = await prisma.coachProfile.update({
    where: { id: coach.id },
    data: patch,
  });

  if (importedPhotoUrl && coach.userId) {
    const linkedUser = await prisma.user.findUnique({
      where: { id: coach.userId },
      select: { id: true, avatarUrl: true },
    });
    if (linkedUser && !linkedUser.avatarUrl?.trim()) {
      await prisma.user.update({
        where: { id: linkedUser.id },
        data: { avatarUrl: importedPhotoUrl },
      });
    }
  }

  return { coach: updated, appliedFields };
}
