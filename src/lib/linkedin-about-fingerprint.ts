import type { ParsedResumeData } from "@/lib/resume-parse";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";

/** Stable fingerprint of About data that feeds the LinkedIn draft. */
export function aboutProfileFingerprint(input: {
  parsed: ParsedResumeData | null;
  headline?: string | null;
  summary?: string | null;
}): string {
  const parsed = input.parsed;
  const work = (parsed?.workExperience ?? []).map((w) => ({
    id: w.id,
    company: w.company,
    title: w.title,
    from: w.from,
    to: w.to,
    bullets: w.bullets,
    description: w.description,
  }));
  const education = (parsed?.education ?? []).map((e) => ({
    id: e.id,
    school: e.school,
    degree: e.degree,
    field: e.field,
  }));
  return JSON.stringify({
    headline: input.headline?.trim() ?? "",
    summary: input.summary?.trim() ?? parsed?.summary?.trim() ?? "",
    location: parsed?.location?.trim() ?? "",
    work,
    education,
    skills: parsed?.skills ?? [],
    tools: parsed?.tools ?? [],
  });
}

export function linkedInDraftIsStaleFromAbout(input: {
  draft: LinkedInProfileDraft | null;
  currentFingerprint: string;
}): boolean {
  if (!input.draft) return false;
  const saved = input.draft.aboutFingerprint?.trim();
  if (!saved) return false;
  return saved !== input.currentFingerprint;
}

export function withAboutFingerprint(
  draft: LinkedInProfileDraft,
  fingerprint: string,
): LinkedInProfileDraft {
  return { ...draft, aboutFingerprint: fingerprint };
}
