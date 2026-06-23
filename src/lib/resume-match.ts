import type { ParsedResumeData, ResumeSectionId } from "./resume-parse";
import { sectionTextBlob } from "./resume-parse";

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

const STOP = new Set(["about", "and", "are", "for", "from", "have", "must", "need", "not", "our", "role", "that", "the", "this", "with", "will", "you", "your"]);

function extractTerms(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9+#./-]{3,}/g) || [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const t of raw) {
    if (STOP.has(t) || seen.has(t)) continue;
    seen.add(t);
    terms.push(t);
  }
  return terms;
}

function labelForScore(score: number): string {
  if (score >= 8.5) return "Excellent";
  if (score >= 7) return "Strong";
  if (score >= 5.5) return "Good";
  if (score >= 4) return "Fair";
  return "Poor";
}

export function fallbackJobMatch(description: string, resumeText: string): JobMatchResult {
  const terms = extractTerms(description).slice(0, 15);
  const resumeLower = resumeText.toLowerCase();
  const keywords = terms.map((text) => ({ text, matched: resumeLower.includes(text) }));
  const matched = keywords.filter((k) => k.matched).length;
  const score = keywords.length ? Math.round((matched / keywords.length) * 100) / 10 : 0;
  return {
    score,
    scoreLabel: labelForScore(score),
    keywords,
    summaryNote: `${matched} of ${keywords.length} key terms from the job description appear in your resume.`,
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
