import type { FullAnalysisReport } from "@/components/scout/profile-resume-analysis-report";
import type { ResumeSectionId } from "@/lib/resume-parse";

export interface ResumeAnalysisStats {
  issueCount: number;
  suggestionCount: number;
}

export function computeAnalysisStats(report: FullAnalysisReport): ResumeAnalysisStats {
  let issueCount = 0;
  let suggestionCount = 0;

  for (const issue of report.issues) {
    if (issue.priority === "Urgent" || issue.priority === "Critical") issueCount += 1;
    else suggestionCount += 1;
  }

  for (const group of report.highlights) {
    for (const item of group.items) {
      if (item.severity === "Urgent" || item.severity === "Critical") {
        issueCount += Math.max(1, item.issueCount);
      } else {
        suggestionCount += Math.max(1, item.issueCount);
      }
    }
  }

  return { issueCount, suggestionCount };
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
