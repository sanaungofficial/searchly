import {
  normalizeParsedResumeData,
  parsedResumeToMatchText,
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
  /** Custom job functions — merged into vsearch query (not Hirebase keywords). */
  customJobFunctions?: string[];
  /** Optional filter keywords — appended briefly, not as a long list. */
  filterKeywords?: string[];
};

/** Join custom job function labels into a short semantic vsearch fragment. */
export function customJobFunctionsToSemanticQuery(customJobFunctions?: string[]): string | undefined {
  const items = (customJobFunctions ?? []).map((s) => s.trim()).filter(Boolean);
  return items.length ? trimVSearchQuery(items.join(". ")) : undefined;
}

/** Merge multiple semantic query fragments for Hirebase vsearch. */
export function mergeVSearchQueryParts(...parts: (string | null | undefined)[]): string | undefined {
  const merged = parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(". ");
  return merged ? trimVSearchQuery(merged) : undefined;
}

/** Build a short semantic query for Hirebase `/v2/jobs/vsearch` summary mode. */
export function buildProfileVSearchQuery(input: ProfileVSearchInput): string | null {
  const parsed = normalizeParsedResumeData(input.parsedData ?? null);
  const parts: string[] = [];

  const semantic = input.semanticQuery?.trim();
  if (semantic) parts.push(semantic);

  const customFns = input.customJobFunctions?.map((f) => f.trim()).filter(Boolean) ?? [];
  if (customFns.length) parts.push(customFns.join(", "));

  const targetRoles = input.targetRoles?.map((r) => r.trim()).filter(Boolean).slice(0, 5) ?? [];
  if (targetRoles.length) parts.push(targetRoles.join(", "));

  if (input.careerMotivation?.trim()) parts.push(input.careerMotivation.trim());

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
    (parsed ? parsedResumeToMatchText(parsed as ParsedResumeData) : "");
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
    (parsed ? parsedResumeToMatchText(parsed as ParsedResumeData) : "") ||
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
