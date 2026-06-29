import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";

export const LINKEDIN_ABOUT_MERGE_SECTIONS = [
  "headline",
  "about",
  "location",
  "experience",
  "education",
  "skills",
] as const;

export type LinkedInAboutMergeSection = (typeof LINKEDIN_ABOUT_MERGE_SECTIONS)[number];

export const LINKEDIN_ABOUT_MERGE_LABELS: Record<LinkedInAboutMergeSection, string> = {
  headline: "Headline",
  about: "About / summary",
  location: "Location",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};

export type LinkedInAboutMergeDiff = {
  section: LinkedInAboutMergeSection;
  label: string;
  hasChange: boolean;
  currentPreview: string;
  proposedPreview: string;
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

function sectionDiffers(
  section: LinkedInAboutMergeSection,
  current: LinkedInProfileDraft,
  proposed: LinkedInProfileDraft,
): boolean {
  switch (section) {
    case "headline":
      return norm(current.headline) !== norm(proposed.headline);
    case "about":
      return norm(current.about) !== norm(proposed.about);
    case "location":
      return norm(current.location) !== norm(proposed.location);
    case "experience":
      return JSON.stringify(current.experience) !== JSON.stringify(proposed.experience);
    case "education":
      return JSON.stringify(current.education) !== JSON.stringify(proposed.education);
    case "skills":
      return JSON.stringify(current.skills) !== JSON.stringify(proposed.skills);
    default:
      return false;
  }
}

export function diffAboutMergeSections(
  current: LinkedInProfileDraft | null,
  proposed: LinkedInProfileDraft,
): LinkedInAboutMergeDiff[] {
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

  return LINKEDIN_ABOUT_MERGE_SECTIONS.map((section) => {
    const hasChange = sectionDiffers(section, base, proposed);
    let currentPreview = "";
    let proposedPreview = "";

    switch (section) {
      case "headline":
        currentPreview = previewText(base.headline);
        proposedPreview = previewText(proposed.headline);
        break;
      case "about":
        currentPreview = previewText(base.about, 220);
        proposedPreview = previewText(proposed.about, 220);
        break;
      case "location":
        currentPreview = previewText(base.location ?? "");
        proposedPreview = previewText(proposed.location ?? "");
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
    }

    return {
      section,
      label: LINKEDIN_ABOUT_MERGE_LABELS[section],
      hasChange,
      currentPreview,
      proposedPreview,
    };
  });
}

export function applyAboutMergeSections(input: {
  current: LinkedInProfileDraft | null;
  proposed: LinkedInProfileDraft;
  sections: LinkedInAboutMergeSection[];
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
    location: selected.has("location") ? proposed.location : base.location,
    experience: selected.has("experience") ? proposed.experience : base.experience,
    education: selected.has("education") ? proposed.education : base.education,
    skills: selected.has("skills") ? proposed.skills : base.skills,
    featured: base.featured.length ? base.featured : proposed.featured,
    profilePhotoUrl: base.profilePhotoUrl ?? proposed.profilePhotoUrl ?? null,
    coverPhotoUrl: base.coverPhotoUrl ?? proposed.coverPhotoUrl ?? null,
    sourceAssetId: proposed.sourceAssetId ?? base.sourceAssetId ?? null,
    generatedAt: base.generatedAt ?? proposed.generatedAt ?? new Date().toISOString(),
    lastLinkedInImportAt: base.lastLinkedInImportAt ?? null,
    coachNotes: base.coachNotes ?? null,
  };
}

export function defaultSelectedMergeSections(diffs: LinkedInAboutMergeDiff[]): LinkedInAboutMergeSection[] {
  const changed = diffs.filter((d) => d.hasChange).map((d) => d.section);
  if (changed.length > 0) return changed;
  return diffs.map((d) => d.section);
}
