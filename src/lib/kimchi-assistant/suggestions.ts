import type { Job, Profile } from "@prisma/client";
import { jobStageLabel } from "@/lib/kimchi-assistant/stages";
import type { AssistantPageHint, AssistantSuggestion } from "@/lib/kimchi-assistant/types";
import { pipelineJobUrl } from "@/lib/workspace-urls";

type JobRow = Pick<Job, "id" | "company" | "role" | "stage" | "updatedAt" | "appliedAt" | "fitAnalysis">;

function parseFitScore(fitAnalysis: string | null): number {
  if (!fitAnalysis) return 0;
  try {
    const parsed = JSON.parse(fitAnalysis) as { score?: number };
    if (typeof parsed.score === "number") return Math.min(100, Math.round(parsed.score * 10));
  } catch {
    /* ignore */
  }
  return 0;
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function buildAssistantSuggestions(
  jobs: JobRow[],
  profile: Profile | null,
  pageHint?: AssistantPageHint,
): AssistantSuggestion[] {
  const out: AssistantSuggestion[] = [];

  if (!profile?.resumeText?.trim()) {
    out.push({
      id: "upload-resume",
      title: "Upload your resume",
      detail: "Kimchi needs a resume to give honest fit takes and tailor apps.",
      route: "/profile",
      priority: 90,
    });
  }

  if (jobs.length === 0) {
    out.push({
      id: "add-jobs",
      title: "Add jobs to your pipeline",
      detail: "Save a few targets so Kimchi can prioritize follow-ups and fit checks.",
      route: "/opportunities/pipeline",
      priority: 85,
    });
  }

  const appliedStale = jobs.filter((j) => {
    if (!["APPLIED", "SCREENING"].includes(j.stage)) return false;
    const ref = j.appliedAt ?? j.updatedAt;
    const days = daysSince(ref);
    return days !== null && days >= 7;
  });

  if (appliedStale.length > 0) {
    const sample = appliedStale.slice(0, 3);
    out.push({
      id: "follow-up",
      title:
        appliedStale.length === 1
          ? `Follow up on ${appliedStale[0].role}`
          : `${appliedStale.length} apps may need a follow-up`,
      detail: sample.map((j) => `${j.role} at ${j.company} (${jobStageLabel(j.stage)})`).join("; "),
      route: sample[0] ? pipelineJobUrl(sample[0].id) : "/opportunities/pipeline",
      priority: 80,
    });
  }

  const interviewing = jobs.filter((j) => j.stage === "INTERVIEWING");
  if (interviewing.length > 0) {
    const j = interviewing[0];
    out.push({
      id: "interview-prep",
      title: `Prep for ${j.role} interview`,
      detail: `${j.company} — ask Kimchi what to lead with and where you're light.`,
      route: pipelineJobUrl(j.id, "fit"),
      priority: 75,
    });
  }

  const highFitSaved = jobs
    .filter((j) => j.stage === "SAVED" && parseFitScore(j.fitAnalysis) >= 70)
    .slice(0, 2);
  for (const j of highFitSaved) {
    out.push({
      id: `apply-${j.id}`,
      title: `Strong fit: ${j.role}`,
      detail: `${j.company} — ${parseFitScore(j.fitAnalysis)}% match. Worth applying soon.`,
      route: pipelineJobUrl(j.id, "fit"),
      priority: 65,
    });
  }

  if (!profile?.readbackData) {
    out.push({
      id: "finish-readback",
      title: "Finish your profile readback",
      detail: "A clear readback helps Kimchi sound like they actually know your search.",
      route: "/profile",
      priority: 60,
    });
  }

  if (pageHint?.jobDbId && pageHint.jobRole) {
    out.push({
      id: "current-job-fit",
      title: `Check fit for ${pageHint.jobRole}`,
      detail: pageHint.jobCompany ? `At ${pageHint.jobCompany}` : "Open role in your pipeline",
      route: pipelineJobUrl(pageHint.jobDbId, "fit"),
      priority: 70,
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 6);
}
