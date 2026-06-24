import {
  normalizeParsedResumeData,
  parsedResumeToText,
  type ParsedResumeData,
} from "@/lib/resume-parse";

/** Hirebase rejects long queries with chars/tokens that look like injection. */
export const HIREBASE_VSEARCH_QUERY_MAX = 1200;

export type ProfileVSearchInput = {
  headline?: string | null;
  targetRoles?: string[];
  resumeText?: string | null;
  parsedData?: unknown;
  careerMotivation?: string | null;
  priorities?: string[];
  employmentStatus?: string | null;
  jobTimeline?: string | null;
  targetSalary?: number | null;
};

/** Build a natural-language query for Hirebase `/v2/jobs/vsearch` summary mode. */
export function buildProfileVSearchQuery(input: ProfileVSearchInput): string | null {
  const parsed = normalizeParsedResumeData(input.parsedData ?? null);
  const segments: string[] = [];

  const targetRoles = input.targetRoles?.map((r) => r.trim()).filter(Boolean) ?? [];
  if (targetRoles.length) {
    segments.push(`Looking for roles such as ${targetRoles.join(", ")}.`);
  }

  if (input.headline?.trim()) {
    segments.push(input.headline.trim());
  }

  if (input.careerMotivation?.trim()) {
    segments.push(`Career goals: ${input.careerMotivation.trim()}`);
  }

  const priorities = input.priorities?.map((p) => p.trim()).filter(Boolean) ?? [];
  if (priorities.length) {
    segments.push(`Priorities: ${priorities.join(", ")}.`);
  }

  if (parsed?.summary?.trim()) {
    segments.push(parsed.summary.trim());
  }

  const recentRoles = (parsed?.workExperience ?? [])
    .slice(0, 3)
    .map((entry) => {
      const title = entry.title?.trim();
      const company = entry.company?.trim();
      if (title && company) return `${title} at ${company}`;
      return title || company || null;
    })
    .filter(Boolean) as string[];
  if (recentRoles.length) {
    segments.push(`Recent experience includes ${recentRoles.join(", ")}.`);
  }

  const skills = disambiguateSkillNames(
    (parsed?.skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
  );
  if (skills.length) {
    segments.push(`Skills: ${skills.join(", ")}.`);
  }

  if (parsed?.location?.trim()) {
    segments.push(`Based in ${parsed.location.trim()}.`);
  }

  if (input.employmentStatus?.trim()) {
    segments.push(`Employment status: ${input.employmentStatus.trim()}.`);
  }

  if (input.jobTimeline?.trim()) {
    segments.push(`Timeline: ${input.jobTimeline.trim()}.`);
  }

  if (input.targetSalary != null && input.targetSalary > 0) {
    segments.push(`Target compensation around $${input.targetSalary.toLocaleString()}.`);
  }

  let query = segments.join(" ").replace(/\s+/g, " ").trim();

  if (query.length < 48) {
    const resumeBlob =
      input.resumeText?.trim() ||
      (parsed ? parsedResumeToText(parsed as ParsedResumeData) : "");
    if (resumeBlob.length >= 48) {
      query = resumeBlob.slice(0, 1800);
    }
  }

  if (query.length < 20) return null;
  return sanitizeHirebaseVSearchQuery(query);
}

function disambiguateSkillNames(skills: string[]): string[] {
  return skills.map((skill) => (skill.toLowerCase() === "make" ? "Make.com" : skill));
}

/** Strip characters and tokens Hirebase flags as harmful injection patterns. */
export function sanitizeHirebaseVSearchQuery(raw: string): string {
  let query = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[;|`]/g, ", ")
    .replace(/\/{2,}/g, " ")
    .replace(/--+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  query = query.replace(/\bMake\b(?=,|\s*\.|\s*$)/gi, "Make.com");
  query = query.replace(/,\s*,/g, ", ").replace(/\.\s*\./g, ".");

  return query.slice(0, HIREBASE_VSEARCH_QUERY_MAX);
}

export function profileTextForMatchReasons(input: ProfileVSearchInput): string {
  const parsed = normalizeParsedResumeData(input.parsedData ?? null);
  return (
    input.resumeText?.trim() ||
    (parsed ? parsedResumeToText(parsed as ParsedResumeData) : "") ||
    buildProfileVSearchQuery(input) ||
    ""
  );
}
