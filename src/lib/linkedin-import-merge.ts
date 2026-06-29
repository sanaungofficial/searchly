import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";

export const LINKEDIN_IMPORT_MERGE_SECTIONS = [
  "headline",
  "about",
  "experience",
  "education",
  "skills",
  "profilePhoto",
  "coverPhoto",
] as const;

export type LinkedInImportMergeSection = (typeof LINKEDIN_IMPORT_MERGE_SECTIONS)[number];

export const LINKEDIN_IMPORT_MERGE_LABELS: Record<LinkedInImportMergeSection, string> = {
  headline: "Headline",
  about: "About / summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  profilePhoto: "Profile photo",
  coverPhoto: "Cover image",
};

export type LinkedInImportMergeDiff = {
  section: LinkedInImportMergeSection;
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

function previewText(text: string, max = 160): string {
  const trimmed = text.trim();
  if (!trimmed) return "(empty)";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function experiencePreview(draft: LinkedInProfileDraft): string {
  if (!draft.experience.length) return "(empty)";
  return draft.experience
    .slice(0, 3)
    .map((exp) => `${exp.title || "Role"}${exp.company ? ` at ${exp.company}` : ""}`)
    .join(" · ");
}

function educationPreview(draft: LinkedInProfileDraft): string {
  if (!draft.education.length) return "(empty)";
  return draft.education
    .slice(0, 3)
    .map((edu) => `${edu.degree || "Degree"}${edu.school ? ` · ${edu.school}` : ""}`)
    .join(" · ");
}

function skillsPreview(draft: LinkedInProfileDraft): string {
  if (!draft.skills.length) return "(empty)";
  return draft.skills.slice(0, 8).join(", ");
}

function photoPreview(url: string | null | undefined): string {
  return url?.trim() ? "Photo on file" : "(no photo)";
}

function sectionDiffers(
  section: LinkedInImportMergeSection,
  current: LinkedInProfileDraft,
  proposed: LinkedInProfileDraft,
): boolean {
  switch (section) {
    case "headline":
      return norm(current.headline) !== norm(proposed.headline);
    case "about":
      return norm(current.about) !== norm(proposed.about);
    case "experience":
      return JSON.stringify(current.experience) !== JSON.stringify(proposed.experience);
    case "education":
      return JSON.stringify(current.education) !== JSON.stringify(proposed.education);
    case "skills":
      return JSON.stringify(current.skills) !== JSON.stringify(proposed.skills);
    case "profilePhoto":
      return norm(current.profilePhotoUrl) !== norm(proposed.profilePhotoUrl);
    case "coverPhoto":
      return norm(current.coverPhotoUrl) !== norm(proposed.coverPhotoUrl);
    default:
      return false;
  }
}

export function diffImportMergeSections(
  current: LinkedInProfileDraft | null,
  proposed: LinkedInProfileDraft,
): LinkedInImportMergeDiff[] {
  const emptyCurrent: LinkedInProfileDraft = {
    headline: "",
    about: "",
    location: null,
    experience: [],
    education: [],
    skills: [],
    featured: [],
  };
  const base = current ?? emptyCurrent;

  return LINKEDIN_IMPORT_MERGE_SECTIONS.map((section) => {
    const hasChange = sectionDiffers(section, base, proposed);
    let currentPreview = "";
    let proposedPreview = "";
    let kind: "text" | "photo" = "text";
    let currentPhotoUrl: string | null | undefined;
    let proposedPhotoUrl: string | null | undefined;

    switch (section) {
      case "headline":
        currentPreview = previewText(base.headline);
        proposedPreview = previewText(proposed.headline);
        break;
      case "about":
        currentPreview = previewText(base.about, 220);
        proposedPreview = previewText(proposed.about, 220);
        break;
      case "experience":
        currentPreview = experiencePreview(base);
        proposedPreview = experiencePreview(proposed);
        break;
      case "education":
        currentPreview = educationPreview(base);
        proposedPreview = educationPreview(proposed);
        break;
      case "skills":
        currentPreview = skillsPreview(base);
        proposedPreview = skillsPreview(proposed);
        break;
      case "profilePhoto":
        kind = "photo";
        currentPhotoUrl = base.profilePhotoUrl ?? null;
        proposedPhotoUrl = proposed.profilePhotoUrl ?? null;
        currentPreview = photoPreview(currentPhotoUrl);
        proposedPreview = photoPreview(proposedPhotoUrl);
        break;
      case "coverPhoto":
        kind = "photo";
        currentPhotoUrl = base.coverPhotoUrl ?? null;
        proposedPhotoUrl = proposed.coverPhotoUrl ?? null;
        currentPreview = photoPreview(currentPhotoUrl);
        proposedPreview = photoPreview(proposedPhotoUrl);
        break;
    }

    return {
      section,
      label: LINKEDIN_IMPORT_MERGE_LABELS[section],
      hasChange,
      currentPreview,
      proposedPreview,
      kind,
      currentPhotoUrl,
      proposedPhotoUrl,
    };
  });
}

export function applyImportMergeSections(input: {
  current: LinkedInProfileDraft | null;
  proposed: LinkedInProfileDraft;
  sections: LinkedInImportMergeSection[];
}): LinkedInProfileDraft {
  const { current, proposed, sections } = input;
  const selected = new Set(sections);
  const base: LinkedInProfileDraft = current ?? {
    headline: "",
    about: "",
    location: null,
    experience: [],
    education: [],
    skills: [],
    featured: [],
  };

  return {
    ...base,
    headline: selected.has("headline") ? proposed.headline : base.headline,
    about: selected.has("about") ? proposed.about : base.about,
    location: proposed.location ?? base.location ?? null,
    experience: selected.has("experience") ? proposed.experience : base.experience,
    education: selected.has("education") ? proposed.education : base.education,
    skills: selected.has("skills") ? proposed.skills : base.skills,
    profilePhotoUrl: selected.has("profilePhoto") ? proposed.profilePhotoUrl ?? null : base.profilePhotoUrl ?? null,
    coverPhotoUrl: selected.has("coverPhoto") ? proposed.coverPhotoUrl ?? null : base.coverPhotoUrl ?? null,
    featured: base.featured.length ? base.featured : proposed.featured,
    sourceAssetId: base.sourceAssetId ?? proposed.sourceAssetId ?? null,
    generatedAt: base.generatedAt ?? proposed.generatedAt ?? new Date().toISOString(),
    aboutFingerprint: base.aboutFingerprint ?? null,
    lastLinkedInImportAt: base.lastLinkedInImportAt ?? null,
    coachNotes: base.coachNotes ?? null,
  };
}

export function defaultSelectedImportSections(diffs: LinkedInImportMergeDiff[]): LinkedInImportMergeSection[] {
  const changed = diffs.filter((d) => d.hasChange).map((d) => d.section);
  if (changed.length > 0) return changed;
  return diffs.map((d) => d.section);
}
