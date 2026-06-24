import { parseJsonFromModel, type ParsedResumeData } from "@/lib/resume-parse";

export interface LinkedInExperienceEntry {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  from?: string | null;
  to?: string | null;
  description: string;
  resumeSourceId?: string | null;
}

export interface LinkedInEducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface LinkedInFeaturedLink {
  id: string;
  label: string;
  url: string;
}

export interface LinkedInProfileDraft {
  headline: string;
  about: string;
  experience: LinkedInExperienceEntry[];
  education: LinkedInEducationEntry[];
  skills: string[];
  featured: LinkedInFeaturedLink[];
  profilePhotoUrl?: string | null;
  coverPhotoUrl?: string | null;
  sourceAssetId?: string | null;
  generatedAt?: string | null;
}

const HEADLINE_MAX = 120;
const ABOUT_MAX = 2600;

function asString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asStringOrNull(value: unknown): string | null {
  const s = asString(value);
  return s || null;
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function bulletsToParagraphs(bullets: string[]): string {
  if (!bullets.length) return "";
  return bullets
    .map((b) => b.replace(/^[•\-\*–—]\s*/, "").trim())
    .filter(Boolean)
    .map((b) => (b.endsWith(".") ? b : `${b}.`))
    .join("\n\n");
}

function buildHeadline(resume: ParsedResumeData, targetRoles: string[]): string {
  const latest = resume.workExperience[0];
  const role = targetRoles[0] || latest?.title || "Professional";
  const domain = latest?.company ? `${latest.company} alum` : null;
  const parts = [role];
  if (resume.skills[0]) parts.push(resume.skills[0]);
  if (domain) parts.push(domain);
  const headline = parts.join(" · ");
  return clamp(headline, HEADLINE_MAX);
}

function buildAbout(resume: ParsedResumeData, name: string, targetRoles: string[]): string {
  const firstName = name.split(/\s+/)[0] || "I";
  const hook = targetRoles.length
    ? `${firstName} is a ${targetRoles[0]} focused on delivering measurable impact.`
    : `${firstName} brings hands-on experience across ${resume.workExperience[0]?.title || "their field"}.`;

  const body = resume.summary?.trim()
    || resume.workExperience
      .slice(0, 2)
      .map((w) => `${w.title} at ${w.company}`)
      .join(". ");

  const skillsLine = resume.skills.length
    ? `\n\nCore strengths include ${resume.skills.slice(0, 8).join(", ")}.`
    : "";

  const close = targetRoles.length
    ? `\n\nOpen to opportunities in ${targetRoles.slice(0, 3).join(", ")}.`
    : "";

  return clamp(`${hook}\n\n${body}${skillsLine}${close}`.trim(), ABOUT_MAX);
}

/** Rule-based LinkedIn draft when AI is unavailable (e.g. dev staging). */
export function buildLinkedInDraftHeuristic(input: {
  resume: ParsedResumeData;
  name: string;
  targetRoles: string[];
  sourceAssetId?: string | null;
}): LinkedInProfileDraft {
  const { resume, name, targetRoles, sourceAssetId } = input;

  const experience = resume.workExperience.map((w, index) => ({
    id: w.id || `li_exp_${index}`,
    title: w.title,
    company: w.company,
    location: w.location ?? null,
    from: w.from ?? null,
    to: w.to ?? null,
    description: w.description?.trim() || bulletsToParagraphs(w.bullets),
    resumeSourceId: w.id,
  }));

  const education = resume.education.map((e, index) => ({
    id: e.id || `li_edu_${index}`,
    school: e.school,
    degree: e.field ? `${e.degree}, ${e.field}` : e.degree,
    field: e.field ?? null,
    from: e.from ?? null,
    to: e.to ?? null,
  }));

  const featured: LinkedInFeaturedLink[] = [];
  if (resume.website) {
    featured.push({ id: "feat_0", label: "Portfolio", url: resume.website });
  }
  if (resume.linkedinUrl && resume.website && resume.linkedinUrl !== resume.website) {
    // skip duplicate
  }

  return {
    headline: buildHeadline(resume, targetRoles),
    about: buildAbout(resume, name, targetRoles),
    experience,
    education,
    skills: resume.skills.slice(0, 50),
    featured,
    sourceAssetId: sourceAssetId ?? null,
    generatedAt: new Date().toISOString(),
  };
}

export function normalizeLinkedInDraft(raw: unknown): LinkedInProfileDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const headline = asString(obj.headline);
  const about = asString(obj.about);
  if (!headline && !about) return null;

  const experience = Array.isArray(obj.experience)
    ? obj.experience
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as Record<string, unknown>;
          const title = asString(row.title);
          const company = asString(row.company);
          const description = asString(row.description);
          if (!title && !company && !description) return null;
          return {
            id: asString(row.id) || `li_exp_${index}`,
            title: title || "Role",
            company: company || "Company",
            location: asStringOrNull(row.location),
            from: asStringOrNull(row.from),
            to: asStringOrNull(row.to),
            description,
            resumeSourceId: asStringOrNull(row.resumeSourceId),
          };
        })
        .filter((e): e is LinkedInExperienceEntry => e !== null)
    : [];

  const education = Array.isArray(obj.education)
    ? obj.education
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as Record<string, unknown>;
          const school = asString(row.school);
          const degree = asString(row.degree);
          if (!school && !degree) return null;
          return {
            id: asString(row.id) || `li_edu_${index}`,
            school: school || "School",
            degree: degree || "Degree",
            field: asStringOrNull(row.field),
            from: asStringOrNull(row.from),
            to: asStringOrNull(row.to),
          };
        })
        .filter((e): e is LinkedInEducationEntry => e !== null)
    : [];

  const skills = Array.isArray(obj.skills)
    ? obj.skills.map((s) => asString(s)).filter(Boolean).slice(0, 50)
    : [];

  const featured = Array.isArray(obj.featured)
    ? obj.featured
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as Record<string, unknown>;
          const label = asString(row.label);
          const url = asString(row.url);
          if (!label || !url) return null;
          return { id: asString(row.id) || `feat_${index}`, label, url };
        })
        .filter((f): f is LinkedInFeaturedLink => f !== null)
    : [];

  return {
    headline: clamp(headline, HEADLINE_MAX),
    about: clamp(about, ABOUT_MAX),
    experience,
    education,
    skills,
    featured,
    profilePhotoUrl: asStringOrNull(obj.profilePhotoUrl),
    coverPhotoUrl: asStringOrNull(obj.coverPhotoUrl),
    sourceAssetId: asStringOrNull(obj.sourceAssetId),
    generatedAt: asStringOrNull(obj.generatedAt),
  };
}

export function parseLinkedInDraftFromModel(text: string): LinkedInProfileDraft | null {
  return normalizeLinkedInDraft(parseJsonFromModel(text));
}

export type LinkedInChecklistItem = {
  id: string;
  section: string;
  label: string;
  copyText: string;
  linkedInHint: string;
  imageUrl?: string | null;
};

export function linkedInChecklist(draft: LinkedInProfileDraft): LinkedInChecklistItem[] {
  const items: LinkedInChecklistItem[] = [];

  if (draft.coverPhotoUrl) {
    items.push({
      id: "cover_photo",
      section: "Intro",
      label: "Cover photo",
      copyText: draft.coverPhotoUrl,
      linkedInHint: "Profile → Intro → Background photo → Upload",
      imageUrl: draft.coverPhotoUrl,
    });
  }

  if (draft.profilePhotoUrl) {
    items.push({
      id: "profile_photo",
      section: "Intro",
      label: "Profile photo",
      copyText: draft.profilePhotoUrl,
      linkedInHint: "Profile photo → Camera icon → Upload photo",
      imageUrl: draft.profilePhotoUrl,
    });
  }

  items.push(
    {
      id: "headline",
      section: "Intro",
      label: "Headline",
      copyText: draft.headline,
      linkedInHint: "Profile → Intro → Headline",
    },
    {
      id: "about",
      section: "About",
      label: "About section",
      copyText: draft.about,
      linkedInHint: "Profile → About → Description",
    },
  );

  draft.experience.forEach((exp) => {
    items.push({
      id: `exp_${exp.id}`,
      section: "Experience",
      label: `${exp.title} at ${exp.company}`,
      copyText: exp.description,
      linkedInHint: "Profile → Experience → Edit role → Description",
    });
  });

  if (draft.skills.length) {
    items.push({
      id: "skills",
      section: "Skills",
      label: "Skills to add",
      copyText: draft.skills.join(", "),
      linkedInHint: "Profile → Skills → Add skills",
    });
  }

  draft.featured.forEach((f) => {
    items.push({
      id: `feat_${f.id}`,
      section: "Featured",
      label: f.label,
      copyText: f.url,
      linkedInHint: "Profile → Featured → Add link",
    });
  });

  return items;
}

export function linkedInEditUrl(linkedinUrl: string | null | undefined): string {
  if (!linkedinUrl?.trim()) return "https://www.linkedin.com/in/me/";
  const url = linkedinUrl.trim().replace(/\/$/, "");
  return `${url}/`;
}
