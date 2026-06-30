import type { ParsedResumeData, ResumeSectionId } from "./resume-parse";
import { sectionTextBlob } from "./resume-parse";
import { computeResumeJobMatch } from "./resume-job-comparison";

export interface JobMatchKeyword {
  text: string;
  matched: boolean;
}

export interface JobMatchResult {
  score: number;
  scoreLabel: string;
  keywords: JobMatchKeyword[];
  summaryNote?: string;
  _fallback?: boolean;
}

export function fallbackJobMatch(
  description: string,
  resumeText: string,
  options?: { excludeTerms?: string[]; jobTitle?: string; company?: string },
): JobMatchResult {
  const full = computeResumeJobMatch({
    jobTitle: options?.jobTitle ?? "Target role",
    company: options?.company,
    description,
    resumeText,
    excludeTerms: options?.excludeTerms,
  });
  return {
    score: full.score,
    scoreLabel: full.scoreLabel,
    keywords: full.keywords,
    summaryNote: full.summaryNote,
    _fallback: true,
  };
}

export function computeSectionMatches(data: ParsedResumeData, keywords: JobMatchKeyword[]) {
  const matched = keywords.filter((k) => k.matched);
  if (!matched.length) return {} as Partial<Record<ResumeSectionId, boolean>>;
  const out: Partial<Record<ResumeSectionId, boolean>> = {};
  for (const sectionId of ["summary", "skills", "experience", "education", "certifications"] as ResumeSectionId[]) {
    const blob = sectionTextBlob(data, sectionId).toLowerCase();
    if (!blob.trim()) continue;
    out[sectionId] = matched.some((k) => blob.includes(k.text.toLowerCase()));
  }
  return out;
}

export function computeExperienceEntryMatches(data: ParsedResumeData, keywords: JobMatchKeyword[]) {
  const matched = keywords.filter((k) => k.matched);
  const out: Record<string, boolean> = {};
  for (const w of data.workExperience) {
    const blob = sectionTextBlob(data, "experience", w.id).toLowerCase();
    out[w.id] = matched.some((k) => blob.includes(k.text.toLowerCase()));
  }
  return out;
}
