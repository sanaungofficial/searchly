import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import { mapApifyProfileToParsedData } from "@/lib/apify-linkedin";
import type { CoachProfile } from "@prisma/client";

export const COACH_LINKEDIN_IMPORT_SECTIONS = [
  "displayName",
  "headline",
  "bio",
  "aboutMe",
  "currentRole",
  "currentCompany",
  "location",
  "linkedinUrl",
  "photoUrl",
  "firms",
  "schools",
  "specialties",
] as const;

export type CoachLinkedInImportSection = (typeof COACH_LINKEDIN_IMPORT_SECTIONS)[number];

export const COACH_LINKEDIN_IMPORT_LABELS: Record<CoachLinkedInImportSection, string> = {
  displayName: "Display name",
  headline: "Headline",
  bio: "Bio",
  aboutMe: "About me (extended)",
  currentRole: "Current role",
  currentCompany: "Current company",
  location: "Location",
  linkedinUrl: "LinkedIn URL",
  photoUrl: "Profile photo",
  firms: "Firms",
  schools: "Schools",
  specialties: "Specialties",
};

export type CoachLinkedInImportProposed = {
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  aboutMe: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  photoSourceUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
};

export type CoachLinkedInImportMergeDiff = {
  section: CoachLinkedInImportSection;
  label: string;
  hasChange: boolean;
  currentPreview: string;
  proposedPreview: string;
  kind: "text" | "photo";
  currentPhotoUrl?: string | null;
  proposedPhotoUrl?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function previewText(text: string | null | undefined, max = 160): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "(empty)";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function listPreview(items: string[] | null | undefined): string {
  if (!items?.length) return "(empty)";
  return items.slice(0, 6).join(", ");
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

export function buildCoachLinkedInImportProposed(input: {
  scraped: ApifyLinkedInProfile;
  linkedinUrl: string;
}): CoachLinkedInImportProposed {
  const { scraped, linkedinUrl } = input;
  const parsed = mapApifyProfileToParsedData(scraped);
  const position = firstCurrentPosition(scraped);
  const summary = parsed.summary?.trim() || null;

  const firms = (scraped.positions ?? [])
    .map((item) => item.companyName?.trim())
    .filter(Boolean) as string[];

  const schools = (scraped.educations ?? [])
    .map(formatSchoolEntry)
    .filter(Boolean) as string[];

  return {
    displayName: parsed.name?.trim() || null,
    headline: scraped.headline?.trim() || null,
    bio: summary,
    aboutMe: summary,
    currentRole: position?.title?.trim() || null,
    currentCompany: position?.companyName?.trim() || null,
    location: scraped.locationName?.trim() || null,
    linkedinUrl,
    photoSourceUrl: scraped.picture?.trim() || null,
    firms,
    schools,
    specialties: parsed.skills,
  };
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

function sectionDiffers(
  section: CoachLinkedInImportSection,
  coach: CoachProfile,
  proposed: CoachLinkedInImportProposed,
): boolean {
  switch (section) {
    case "displayName":
      return norm(coach.displayName) !== norm(proposed.displayName);
    case "headline":
      return norm(coach.headline) !== norm(proposed.headline);
    case "bio":
      return norm(coach.bio) !== norm(proposed.bio);
    case "aboutMe":
      return norm(coach.aboutMe) !== norm(proposed.aboutMe);
    case "currentRole":
      return norm(coach.currentRole) !== norm(proposed.currentRole);
    case "currentCompany":
      return norm(coach.currentCompany) !== norm(proposed.currentCompany);
    case "location":
      return norm(coach.location) !== norm(proposed.location);
    case "linkedinUrl":
      return norm(coach.linkedinUrl) !== norm(proposed.linkedinUrl);
    case "photoUrl":
      return norm(coach.photoUrl) !== norm(proposed.photoSourceUrl) && !!proposed.photoSourceUrl;
    case "firms":
      return JSON.stringify(coach.firms ?? []) !== JSON.stringify(proposedListValue("firms", coach, proposed));
    case "schools":
      return JSON.stringify(coach.schools ?? []) !== JSON.stringify(proposedListValue("schools", coach, proposed));
    case "specialties":
      return JSON.stringify(coach.specialties ?? []) !== JSON.stringify(proposedListValue("specialties", coach, proposed));
    default:
      return false;
  }
}

export function diffCoachLinkedInImportSections(
  coach: CoachProfile,
  proposed: CoachLinkedInImportProposed,
): CoachLinkedInImportMergeDiff[] {
  return COACH_LINKEDIN_IMPORT_SECTIONS.map((section) => {
    const hasChange = sectionDiffers(section, coach, proposed);
    let currentPreview = "";
    let proposedPreview = "";
    let kind: "text" | "photo" = "text";
    let currentPhotoUrl: string | null | undefined;
    let proposedPhotoUrl: string | null | undefined;

    switch (section) {
      case "displayName":
        currentPreview = previewText(coach.displayName);
        proposedPreview = previewText(proposed.displayName);
        break;
      case "headline":
        currentPreview = previewText(coach.headline);
        proposedPreview = previewText(proposed.headline);
        break;
      case "bio":
        currentPreview = previewText(coach.bio, 220);
        proposedPreview = previewText(proposed.bio, 220);
        break;
      case "aboutMe":
        currentPreview = previewText(coach.aboutMe, 220);
        proposedPreview = previewText(proposed.aboutMe, 220);
        break;
      case "currentRole":
        currentPreview = previewText(coach.currentRole);
        proposedPreview = previewText(proposed.currentRole);
        break;
      case "currentCompany":
        currentPreview = previewText(coach.currentCompany);
        proposedPreview = previewText(proposed.currentCompany);
        break;
      case "location":
        currentPreview = previewText(coach.location);
        proposedPreview = previewText(proposed.location);
        break;
      case "linkedinUrl":
        currentPreview = previewText(coach.linkedinUrl);
        proposedPreview = previewText(proposed.linkedinUrl);
        break;
      case "photoUrl":
        kind = "photo";
        currentPhotoUrl = coach.photoUrl;
        proposedPhotoUrl = proposed.photoSourceUrl;
        currentPreview = coach.photoUrl?.trim() ? "Photo on file" : "(no photo)";
        proposedPreview = proposed.photoSourceUrl?.trim() ? "Photo from LinkedIn" : "(no photo)";
        break;
      case "firms":
        currentPreview = listPreview(coach.firms);
        proposedPreview = listPreview(proposedListValue("firms", coach, proposed));
        break;
      case "schools":
        currentPreview = listPreview(coach.schools);
        proposedPreview = listPreview(proposedListValue("schools", coach, proposed));
        break;
      case "specialties":
        currentPreview = listPreview(coach.specialties);
        proposedPreview = listPreview(proposedListValue("specialties", coach, proposed));
        break;
    }

    return {
      section,
      label: COACH_LINKEDIN_IMPORT_LABELS[section],
      hasChange,
      currentPreview,
      proposedPreview,
      kind,
      currentPhotoUrl,
      proposedPhotoUrl,
    };
  });
}

export function defaultSelectedCoachImportSections(diffs: CoachLinkedInImportMergeDiff[]): CoachLinkedInImportSection[] {
  const changed = diffs.filter((d) => d.hasChange).map((d) => d.section);
  if (changed.length > 0) return changed;
  return diffs.map((d) => d.section);
}

export function buildCoachLinkedInImportPreview(input: {
  coach: CoachProfile;
  scraped: ApifyLinkedInProfile;
  linkedinUrl: string;
}) {
  const proposed = buildCoachLinkedInImportProposed({
    scraped: input.scraped,
    linkedinUrl: input.linkedinUrl,
  });
  return {
    proposed,
    diffs: diffCoachLinkedInImportSections(input.coach, proposed),
  };
}
