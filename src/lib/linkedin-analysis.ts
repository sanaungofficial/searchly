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

export const LINKEDIN_SECTION_IMPACT: Record<
  LinkedInSectionId,
  { title: string; issueDetected: string; whyItMatters: string; howToImprove: string }
> = {
  headline: {
    title: "Your headline is the first thing recruiters see",
    issueDetected: "LinkedIn search results show your photo, name, and headline before anything else.",
    whyItMatters:
      "Recruiters decide in seconds whether to click your profile. A keyword-rich headline improves discovery and signals fit for your target roles.",
    howToImprove:
      "Use a formula like: Role | Specialty | Impact area. Include 2-3 keywords from roles you want, not just your current title.",
  },
  about: {
    title: "Your About section tells your story",
    issueDetected: "The first two lines appear before 'see more' — most visitors never expand.",
    whyItMatters:
      "Recruiters skim for themes, seniority, and proof of impact. A strong hook keeps them reading and builds credibility.",
    howToImprove:
      "Open with a punchy hook (who you help + how), then 2-3 short paragraphs on themes and wins. End with a soft call to connect.",
  },
  experience: {
    title: "Experience should show impact, not duties",
    issueDetected: "LinkedIn readers expect short paragraphs with outcomes, not pasted resume bullets.",
    whyItMatters:
      "Hiring managers look for scope, metrics, and relevance to the role they are filling. Vague bullets get skipped.",
    howToImprove:
      "Lead each role with context, then 2-4 paragraphs highlighting measurable results and skills that match your target roles.",
  },
  education: {
    title: "Education supports your level and credibility",
    issueDetected: "Missing or thin education can raise questions about baseline qualifications.",
    whyItMatters:
      "Recruiters use education to validate seniority filters and domain credibility, especially for career pivots.",
    howToImprove:
      "Include degree, school, and relevant highlights (honors, thesis, activities) that reinforce your target path.",
  },
  skills: {
    title: "Skills power LinkedIn search",
    issueDetected: "Profiles with fewer than 5 relevant skills rank lower in recruiter searches.",
    whyItMatters:
      "Recruiters filter by skills. Endorsements and skill order affect whether you appear in search results.",
    howToImprove:
      "Add 10-20 skills aligned to your target roles. Put the most important ones first.",
  },
};

export function getLinkedInSectionFixIssues(
  sectionId: LinkedInSectionId,
  fullReport: ReturnType<typeof linkedInAnalysisToReport>,
  mode: "all" | "impact" = "all",
) {
  const pattern = SECTION_PATTERNS[sectionId];
  const baseline = {
    id: `${sectionId}-baseline`,
    severity: "Critical" as const,
    title: LINKEDIN_SECTION_IMPACT[sectionId].title,
    issueDetected: LINKEDIN_SECTION_IMPACT[sectionId].issueDetected,
    whyItMatters: LINKEDIN_SECTION_IMPACT[sectionId].whyItMatters,
    howToImprove: LINKEDIN_SECTION_IMPACT[sectionId].howToImprove,
  };

  const fromHighlights = fullReport.highlights.flatMap((group) =>
    group.items
      .filter((item) => item.sectionHint === sectionId || pattern.test(`${item.title} ${item.summary}`))
      .map((item, i) => ({
        id: `${sectionId}-h-${i}`,
        severity: item.severity,
        title: item.title,
        issueDetected: item.summary,
        whyItMatters: item.whyItMatters,
        howToImprove: item.summary,
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
  const withBaseline = [baseline, ...combined];

  if (mode === "impact") {
    return [baseline, ...combined.filter((issue) => issue.severity === "Urgent" || issue.severity === "Critical")];
  }
  return withBaseline;
}

export const LINKEDIN_SECTION_TITLES: Record<LinkedInSectionId, string> = {
  headline: "Headline",
  about: "About",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};
