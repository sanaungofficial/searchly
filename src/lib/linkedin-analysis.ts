import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";
import type { ReportIssue } from "@/components/scout/profile-resume-editor-panels";
import type { ReportHighlightCategory } from "@/components/scout/profile-resume-analysis-report";
import { parseJsonFromModel } from "@/lib/resume-parse";
import { scoreToGrade } from "@/components/scout/profile-resume-analysis-report";

export type LinkedInSectionId = "headline" | "about" | "experience" | "education" | "skills";

export interface LinkedInAnalysisData {
  score?: number;
  headline?: string;
  strengths?: string[];
  improvements?: { priority: string; title: string; detail: string }[];
  highlights?: {
    category: string;
    items: {
      severity: string;
      title: string;
      issueCount?: number;
      summary: string;
      whyItMatters: string;
      sectionHint?: LinkedInSectionId;
    }[];
  }[];
  _cachedAt?: string;
  error?: string;
}

export function linkedInDraftCompleteness(draft: LinkedInProfileDraft): { pct: number; missing: string[] } {
  const missing: string[] = [];
  let points = 0;
  const max = 10;

  if (draft.headline.trim().length >= 40) points += 1;
  else missing.push("Stronger headline (40+ chars with keywords)");

  if (draft.about.trim().length >= 200) points += 2;
  else missing.push("Expand About section with themes and impact");

  if (draft.experience.length > 0) points += 1;
  else missing.push("Add experience entries");

  const withImpact = draft.experience.filter(
    (e) => e.description.trim().length >= 120 || /\d+%|\$\d|#\d|\d\+/.test(e.description),
  ).length;
  if (withImpact >= Math.min(2, draft.experience.length)) points += 2;
  else missing.push("Add measurable impact in experience descriptions");

  if (draft.education.length > 0) points += 1;
  else missing.push("Add education");

  if (draft.skills.length >= 5) points += 2;
  else missing.push("Add at least 5 skills");

  if (draft.profilePhotoUrl) points += 0.5;
  if (draft.coverPhotoUrl) points += 0.5;

  return { pct: Math.round((points / max) * 100), missing };
}

export function normalizeLinkedInAnalysis(raw: unknown): LinkedInAnalysisData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const score = typeof obj.score === "number" ? Math.round(obj.score) : undefined;
  return {
    score,
    headline: typeof obj.headline === "string" ? obj.headline : undefined,
    strengths: Array.isArray(obj.strengths) ? obj.strengths.filter((s): s is string => typeof s === "string") : undefined,
    improvements: Array.isArray(obj.improvements)
      ? obj.improvements
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const title = typeof r.title === "string" ? r.title : "";
            const detail = typeof r.detail === "string" ? r.detail : "";
            const priority = typeof r.priority === "string" ? r.priority : "Optional";
            if (!title) return null;
            return { priority, title, detail };
          })
          .filter((x): x is { priority: string; title: string; detail: string } => x !== null)
      : undefined,
    highlights: Array.isArray(obj.highlights)
      ? (obj.highlights as LinkedInAnalysisData["highlights"])
      : undefined,
  };
}

export function parseLinkedInAnalysisFromModel(text: string): LinkedInAnalysisData | null {
  return normalizeLinkedInAnalysis(parseJsonFromModel(text));
}

export function linkedInAnalysisToReport(
  analysis: LinkedInAnalysisData | null,
  draft: LinkedInProfileDraft | null,
) {
  const completeness = draft ? linkedInDraftCompleteness(draft) : { pct: 0, missing: [] };
  const issues: ReportIssue[] = [];

  if (analysis?.improvements?.length) {
    for (const imp of analysis.improvements) {
      issues.push({
        priority:
          imp.priority === "Urgent" || imp.priority === "Critical" || imp.priority === "Optional"
            ? imp.priority
            : "Optional",
        title: imp.title,
        detail: imp.detail,
      });
    }
  } else {
    completeness.missing.forEach((m, i) => {
      issues.push({
        priority: i === 0 ? "Urgent" : i === 1 ? "Critical" : "Optional",
        title: m,
        detail: `Improve your LinkedIn ${m.toLowerCase()}.`,
      });
    });
  }

  const highlights = (analysis?.highlights ?? []).map((group) => ({
    category: group.category,
    items: group.items.map((item) => ({
      severity:
        item.severity === "Urgent" ||
        item.severity === "Critical" ||
        item.severity === "Optional" ||
        item.severity === "Minor"
          ? item.severity
          : "Optional",
      title: item.title,
      issueCount: item.issueCount ?? 1,
      summary: item.summary,
      whyItMatters: item.whyItMatters,
      sectionHint: item.sectionHint as ReportHighlightCategory["items"][0]["sectionHint"],
    })),
  })) as ReportHighlightCategory[];

  const score = analysis?.score ?? completeness.pct;
  const { grade, label: gradeLabel } = scoreToGrade(score);

  return {
    score,
    grade,
    gradeLabel,
    headline: analysis?.headline ?? "LinkedIn profile quality based on completeness and recruiter best practices.",
    strengths: analysis?.strengths,
    issues,
    highlights,
    updatedAt: analysis?._cachedAt ?? null,
  };
}

const SECTION_PATTERNS: Record<LinkedInSectionId, RegExp> = {
  headline: /headline|intro|title line|keyword/i,
  about: /about|summary|story|bio|hook/i,
  experience: /experience|role|bullet|impact|achievement|quant|company|position/i,
  education: /education|degree|school|training/i,
  skills: /skill|endorse|competenc/i,
};

export function getLinkedInSectionFixIssues(
  sectionId: LinkedInSectionId,
  fullReport: ReturnType<typeof linkedInAnalysisToReport>,
  mode: "all" | "impact" = "all",
) {
  const pattern = SECTION_PATTERNS[sectionId];
  const fromHighlights = fullReport.highlights.flatMap((group) =>
    group.items
      .filter((item) => item.sectionHint === sectionId || pattern.test(`${item.title} ${item.summary}`))
      .map((item, i) => ({
        id: `${sectionId}-h-${i}`,
        severity: item.severity,
        title: item.title,
        issueDetected: item.summary,
        whyItMatters: item.whyItMatters,
        howToImprove: item.whyItMatters,
      })),
  );

  const fromIssues = fullReport.issues
    .filter((issue) => pattern.test(`${issue.title} ${issue.detail}`))
    .map((issue, i) => ({
      id: `${sectionId}-i-${i}`,
      severity: issue.priority,
      title: issue.title,
      issueDetected: issue.detail,
      whyItMatters: issue.detail,
      howToImprove: issue.detail,
    }));

  const combined = fromHighlights.length ? fromHighlights : fromIssues;
  if (mode === "impact") {
    return combined.filter((issue) => issue.severity === "Urgent" || issue.severity === "Critical");
  }
  return combined;
}

export const LINKEDIN_SECTION_TITLES: Record<LinkedInSectionId, string> = {
  headline: "Headline",
  about: "About",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};
