import {
  normalizeParsedResumeData,
  parsedResumeToText,
  type ParsedResumeData,
} from "@/lib/resume-parse";

/** Keep Hirebase summary queries short — long profile dumps often trigger validation. */
export const HIREBASE_VSEARCH_QUERY_MAX = 500;

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
  /** User-entered focus text from Recommended search. */
  semanticQuery?: string | null;
  /** Optional filter keywords — appended briefly, not as a long list. */
  filterKeywords?: string[];
};

/** Build a short semantic query for Hirebase `/v2/jobs/vsearch` summary mode. */
export function buildProfileVSearchQuery(input: ProfileVSearchInput): string | null {
  const parsed = normalizeParsedResumeData(input.parsedData ?? null);
  const parts: string[] = [];

  const semantic = input.semanticQuery?.trim();
  if (semantic) parts.push(semantic);

  const targetRoles = input.targetRoles?.map((r) => r.trim()).filter(Boolean).slice(0, 5) ?? [];
  if (targetRoles.length) parts.push(targetRoles.join(", "));

  if (input.headline?.trim()) parts.push(input.headline.trim());

  const recentTitle = parsed?.workExperience?.[0]?.title?.trim();
  if (recentTitle) parts.push(recentTitle);

  const location = parsed?.location?.trim();
  if (location) parts.push(location);

  const keywords = input.filterKeywords?.map((k) => k.trim()).filter(Boolean).slice(0, 5) ?? [];
  if (keywords.length) parts.push(keywords.join(", "));

  if (parts.length) {
    return trimVSearchQuery(parts.join(". "));
  }

  const summary = parsed?.summary?.trim();
  if (summary && summary.length >= 15) {
    return trimVSearchQuery(summary);
  }

  const resumeBlob =
    input.resumeText?.trim() ||
    (parsed ? parsedResumeToText(parsed as ParsedResumeData) : "");
  if (resumeBlob.length >= 15) {
    return trimVSearchQuery(resumeBlob);
  }

  return null;
}

/** Normalize whitespace and cap length — no pattern-specific rewriting. */
export function trimVSearchQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, HIREBASE_VSEARCH_QUERY_MAX);
}

/** @deprecated Use trimVSearchQuery — kept so callers don't need churn. */
export const sanitizeHirebaseVSearchQuery = trimVSearchQuery;

export function profileTextForMatchReasons(input: ProfileVSearchInput): string {
  const parsed = normalizeParsedResumeData(input.parsedData ?? null);
  return (
    input.resumeText?.trim() ||
    (parsed ? parsedResumeToText(parsed as ParsedResumeData) : "") ||
    buildProfileVSearchQuery(input) ||
    ""
  );
}

/** Fallback when Hirebase rejects the query — roles only, no profile dump. */
export function buildMinimalVSearchQuery(targetRoles: string[]): string | null {
  const roles = targetRoles.map((r) => r.trim()).filter(Boolean).slice(0, 20);
  if (!roles.length) return null;
  return trimVSearchQuery(roles.join(", "));
}

export function isHarmfulPatternQueryError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  return msg.toLowerCase().includes("harmful pattern");
}
