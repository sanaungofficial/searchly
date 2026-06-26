import type { HirebaseJob } from "@/lib/hirebase";
import { mapHirebaseJob } from "@/lib/hirebase";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { fallbackJobMatch } from "@/lib/resume-match";
import { isLowQualityMatchReason, matchScoreLabelFor, usableKeywordSummary } from "@/lib/match-score";
import type { RoleTitlePreferences } from "@/lib/role-title-preferences";
import {
  applyRoleTitlePreferenceToScore,
  roleTitlePreferenceReasons,
} from "@/lib/role-title-preferences";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

function labelForScore(score: number): string {
  return matchScoreLabelFor(score);
}

function vectorRankScore(rank: number, total: number): number {
  if (total <= 1) return 92;
  const spread = Math.min(total - 1, 19);
  return Math.max(58, Math.round(94 - ((rank - 1) * 32) / Math.max(spread, 1)));
}

function jobDescriptionForMatch(job: HirebaseJob, cached: ReturnType<typeof mapHirebaseJob>): string {
  const parts = [
    job.requirements_summary,
    cached.jobSummary,
    cached.description?.slice(0, 1200),
    job.skills?.length ? `Skills: ${job.skills.join(", ")}` : null,
    job.technologies?.length ? `Technologies: ${job.technologies.join(", ")}` : null,
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 2000);
}

function heuristicMatch(
  job: HirebaseJob,
  cached: ReturnType<typeof mapHirebaseJob>,
  resumeText: string,
  rank: number,
  total: number,
  roleTitlePreferences?: RoleTitlePreferences,
): Pick<VectorMatchedJob, "matchScore" | "matchLabel" | "matchReasons" | "matchedSkills" | "gapSkills"> {
  const description = jobDescriptionForMatch(job, cached);
  const fallback = fallbackJobMatch(description, resumeText);
  const jobSkills = [...(job.skills ?? []), ...(job.technologies ?? [])].map((s) => s.trim()).filter(Boolean);
  const resumeLower = resumeText.toLowerCase();
  const matchedSkills = jobSkills.filter((skill) => resumeLower.includes(skill.toLowerCase())).slice(0, 8);
  const gapSkills = jobSkills.filter((skill) => !resumeLower.includes(skill.toLowerCase())).slice(0, 4);

  const rankScore = vectorRankScore(rank, total);
  const keywordScore = Math.round(fallback.score * 10);
  const baseScore = Math.round(rankScore * 0.55 + keywordScore * 0.45);
  const jobTitle = job.job_title ?? cached.title ?? "";
  const jobCategories = [...(cached.tags ?? []), ...(job.job_categories ?? [])];
  const { matchScore, adjustment } = applyRoleTitlePreferenceToScore(
    baseScore,
    jobTitle,
    roleTitlePreferences ?? {},
    jobCategories,
  );

  const reasons: string[] = [];
  reasons.push(...roleTitlePreferenceReasons(adjustment));
  if (matchedSkills.length) {
    reasons.push(
      `You're a good fit because your background aligns with ${matchedSkills.slice(0, 4).join(", ")}.`,
    );
  }
  if (job.experience_level) {
    reasons.push(`This is a ${job.experience_level}-level role that matches your career targets.`);
  }
  const keywordNote =
    usableKeywordSummary(
      fallback.keywords.filter((k) => k.matched).length,
      fallback.keywords.length,
    ) ?? (fallback.summaryNote && !isLowQualityMatchReason(fallback.summaryNote) ? fallback.summaryNote : null);
  if (keywordNote && reasons.length < 2) {
    reasons.push(keywordNote);
  }
  if (!reasons.length) {
    reasons.push(
      "This role surfaced from your profile and target titles — open the posting to confirm fit.",
    );
  }

  return {
    matchScore,
    matchLabel: labelForScore(matchScore),
    matchReasons: reasons.slice(0, 4),
    matchedSkills,
    gapSkills,
  };
}

type BatchMatchRow = {
  jobId: string;
  matchScore: number;
  matchLabel: string;
  reasons: string[];
  matchedSkills: string[];
  gapSkills: string[];
};

async function claudeBatchMatchReasons(
  resumeText: string,
  jobs: Array<{ job: HirebaseJob; cached: ReturnType<typeof mapHirebaseJob>; rank: number }>
): Promise<Map<string, BatchMatchRow>> {
  const out = new Map<string, BatchMatchRow>();
  if (!isKimchiAiConfigured() || !jobs.length) return out;

  const jobBlocks = jobs
    .map(({ job, cached, rank }) => {
      const id = job._id ?? `rank-${rank}`;
      return [
        `JOB ${id}`,
        `Title: ${job.job_title ?? cached.title}`,
        `Company: ${job.company_name ?? "Unknown"}`,
        `Summary: ${job.requirements_summary ?? cached.jobSummary ?? cached.description?.slice(0, 280) ?? "N/A"}`,
        `Skills: ${[...(job.skills ?? []), ...(job.technologies ?? [])].slice(0, 12).join(", ") || "N/A"}`,
        `Vector rank: ${rank}`,
      ].join("\n");
    })
    .join("\n\n");

  const template = await getPrompt("VECTOR_JOB_MATCH_BATCH");
  const prompt = interpolate(template, {
    resumeSlice: resumeText.slice(0, 6000),
    jobBlocks,
  });

  const { text } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 2500,
    tags: ["feature:vector-job-match"],
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return out;
    const parsed = JSON.parse(jsonMatch[0]) as { matches?: BatchMatchRow[] };
    for (const row of parsed.matches ?? []) {
      if (!row?.jobId) continue;
      out.set(row.jobId, row);
    }
  } catch {
    return out;
  }

  return out;
}

export async function enrichVectorJobsWithMatchReasons(input: {
  rawJobs: HirebaseJob[];
  cachedJobs: ReturnType<typeof mapHirebaseJob>[];
  companyNames: string[];
  resumeText: string;
  /** Skip Claude batch — heuristic scores only (faster for recommended list). */
  heuristicOnly?: boolean;
  roleTitlePreferences?: RoleTitlePreferences;
}): Promise<VectorMatchedJob[]> {
  const { rawJobs, cachedJobs, companyNames, resumeText, heuristicOnly, roleTitlePreferences } = input;
  const pairs = rawJobs.map((job, index) => ({
    job,
    cached: cachedJobs[index] ?? mapHirebaseJob(job),
    rank: index + 1,
  }));

  const claudeRows =
    heuristicOnly !== false
      ? new Map<string, BatchMatchRow>()
      : await claudeBatchMatchReasons(resumeText, pairs).catch((err) => {
          console.warn("[hirebase-match-reasons] Claude batch failed, using heuristics:", err);
          return new Map<string, BatchMatchRow>();
        });

  return pairs.map(({ job, cached, rank }) => {
    const jobId = job._id ?? `rank-${rank}`;
    const companyName = job.company_name?.trim() || companyNames[rank - 1] || "Unknown company";
    const ai = claudeRows.get(jobId);
    const heuristic = heuristicMatch(job, cached, resumeText, rank, pairs.length, roleTitlePreferences);

    const matchScore = ai?.matchScore != null ? Math.min(100, Math.max(0, Math.round(ai.matchScore))) : heuristic.matchScore;
    const matchLabel = ai?.matchLabel?.trim() || labelForScore(matchScore);

    return {
      ...cached,
      companyName,
      vectorRank: rank,
      matchScore,
      matchLabel,
      matchReasons: ai?.reasons?.length ? ai.reasons.slice(0, 4) : heuristic.matchReasons,
      matchedSkills: ai?.matchedSkills?.length ? ai.matchedSkills : heuristic.matchedSkills,
      gapSkills: ai?.gapSkills?.length ? ai.gapSkills : heuristic.gapSkills,
    };
  });
}
