import {
  DEFAULT_SECTION_ORDER,
  emptyParsedResumeData,
  hasResumeBodyContent,
  normalizeParsedResumeData,
  reconcileParsedSkillsTools,
  type ParsedResumeData,
  type ResumeSectionId,
} from "@/lib/resume-parse";

export const PROFILE_MASTER_RESUME_URL = "kimchi://profile-master-resume";

type ProfileLike = {
  parsedData?: unknown;
  summary?: string | null;
  resumeText?: string | null;
  linkedinUrl?: string | null;
} | null;

type UserLike = {
  name?: string | null;
  email?: string | null;
} | null;

/** True when profile has enough structured data to build a master resume without AI. */
export function profileHasResumeMaterial(profile: ProfileLike, user?: UserLike): boolean {
  const parsed = normalizeParsedResumeData(profile?.parsedData ?? null);
  if (hasResumeBodyContent(parsed)) return true;
  if (profile?.summary?.trim() || profile?.resumeText?.trim()) return true;
  if (
    parsed &&
    (parsed.workExperience.length > 0 ||
      parsed.education.length > 0 ||
      parsed.skills.length > 0 ||
      parsed.tools.length > 0)
  ) {
    return true;
  }
  if (user?.name?.trim() && (parsed?.email || user.email)) {
    return hasResumeBodyContent(parsed) || !!profile?.summary?.trim();
  }
  return false;
}

const MVP_SECTION_ORDER: ResumeSectionId[] = ["summary", "experience", "education", "skills"];

function sectionHasContent(data: ParsedResumeData, id: ResumeSectionId): boolean {
  if (id === "summary") return !!data.summary?.trim();
  if (id === "skills") {
    return (
      data.skills.length > 0 ||
      data.tools.length > 0 ||
      data.skillGroups.some((g) => g.skills.length > 0)
    );
  }
  if (id === "experience") return data.workExperience.length > 0;
  if (id === "education") return data.education.length > 0;
  if (id === "certifications") return data.certifications.length > 0;
  return false;
}

/** Deterministic resume structure from profile fields — no AI. */
export function buildParsedDataFromProfile(input: {
  profile: ProfileLike;
  user: UserLike;
}): ParsedResumeData {
  const base = normalizeParsedResumeData(input.profile?.parsedData ?? null) ?? emptyParsedResumeData();

  const merged: ParsedResumeData = {
    ...base,
    name: base.name?.trim() || input.user?.name?.trim() || null,
    email: base.email?.trim() || input.user?.email?.trim() || null,
    summary: base.summary?.trim() || input.profile?.summary?.trim() || null,
    linkedinUrl: base.linkedinUrl?.trim() || input.profile?.linkedinUrl?.trim() || null,
  };

  const parsed = reconcileParsedSkillsTools({
    ...merged,
    sectionOrder: MVP_SECTION_ORDER.filter((id) => sectionHasContent(merged, id)),
  });

  if (!parsed.sectionOrder?.length) {
    parsed.sectionOrder = DEFAULT_SECTION_ORDER.filter((id) => sectionHasContent(parsed, id));
  }

  return parsed;
}
