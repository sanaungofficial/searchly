import type { FullAnalysisReport } from "@/components/scout/profile-resume-analysis-report";
import type { ResumeSectionId } from "@/lib/resume-parse";

export interface ResumeAnalysisStats {
  issueCount: number;
  suggestionCount: number;
  urgentCount: number;
  criticalCount: number;
  optionalCount: number;
}

export function computeFixCountsByPriority(report: FullAnalysisReport): Pick<ResumeAnalysisStats, "urgentCount" | "criticalCount" | "optionalCount"> {
  let urgentCount = 0;
  let criticalCount = 0;
  let optionalCount = 0;

  for (const issue of report.issues) {
    if (issue.priority === "Urgent") urgentCount += 1;
    else if (issue.priority === "Critical") criticalCount += 1;
    else optionalCount += 1;
  }

  for (const group of report.highlights) {
    for (const item of group.items) {
      const n = Math.max(1, item.issueCount);
      if (item.severity === "Urgent") urgentCount += n;
      else if (item.severity === "Critical") criticalCount += n;
      else optionalCount += n;
    }
  }

  return { urgentCount, criticalCount, optionalCount };
}

export function computeAnalysisStats(report: FullAnalysisReport): ResumeAnalysisStats {
  const { urgentCount, criticalCount, optionalCount } = computeFixCountsByPriority(report);
  const issueCount = urgentCount + criticalCount;
  const suggestionCount = optionalCount;
  return { issueCount, suggestionCount, urgentCount, criticalCount, optionalCount };
}

const COMPLETENESS_FIX_COPY: Record<string, { issueDetected: string; whyItMatters: string; howToImprove: string }> = {
  Summary: {
    issueDetected: "Your resume has no professional summary.",
    whyItMatters: "Recruiters often read the summary first — it should quickly convey your role, strengths, and target.",
    howToImprove: "Add 2–4 lines with your title, top strengths, and the kind of role you want next.",
  },
  Skills: {
    issueDetected: "No skills or tools are listed yet.",
    whyItMatters: "Keyword-rich skills help both ATS filters and human reviewers scan fit faster.",
    howToImprove: "Add a concise list of role-relevant skills, tools, and domains of expertise.",
  },
  Experience: {
    issueDetected: "No work experience section is filled in.",
    whyItMatters: "Experience bullets are the core evidence of your impact and seniority.",
    howToImprove: "Add recent roles with measurable accomplishments — one bullet per line.",
  },
  Education: {
    issueDetected: "Education is missing from the resume.",
    whyItMatters: "Many roles expect degree or training details for baseline qualification checks.",
    howToImprove: "Add your degree, school, and graduation year (or expected year).",
  },
  Name: {
    issueDetected: "Your name is not on the resume header.",
    whyItMatters: "A clear name anchors the document and is required for most applications.",
    howToImprove: "Add your full name at the top of the resume.",
  },
  Contact: {
    issueDetected: "Email or phone is missing from the header.",
    whyItMatters: "Recruiters need a direct way to reach you.",
    howToImprove: "Add a professional email address and phone number.",
  },
  Location: {
    issueDetected: "Location is not listed in the header.",
    whyItMatters: "Location helps recruiters assess remote, relocation, and commute fit.",
    howToImprove: "Add city and state (or region) where you are based.",
  },
};

export function completenessFixCopy(label: string) {
  return COMPLETENESS_FIX_COPY[label] ?? null;
}

export function countSectionIssues(
  sectionId: ResumeSectionId,
  entryKey: string | undefined,
  report: FullAnalysisReport,
): number {
  const patterns: Record<ResumeSectionId, RegExp> = {
    summary: /summary|overview|headline|professional summary/i,
    skills: /skill|emphasis|keyword|competenc/i,
    experience: /experience|accomplish|bullet|impact|methodology|work|achievement|quant/i,
    education: /education|degree|training|school|mba/i,
    certifications: /certif|credential|license/i,
  };
  const pattern = patterns[sectionId];
  let count = 0;

  for (const group of report.highlights) {
    for (const item of group.items) {
      const text = `${item.title} ${item.summary}`;
      const sectionMatch = item.sectionHint === sectionId || pattern.test(text);
      if (!sectionMatch) continue;
      if (entryKey && sectionId === "experience") {
        if (!text.toLowerCase().includes(entryKey.toLowerCase())) continue;
      }
      count += Math.max(1, item.issueCount);
    }
  }

  if (count === 0) {
    count = report.issues.filter((i) => pattern.test(`${i.title} ${i.detail}`)).length;
  }

  return count;
}
