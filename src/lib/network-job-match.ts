import type { NetworkJobListing } from "@/lib/network-job-display";
import { fallbackJobMatch } from "@/lib/resume-match";
import {
  isLowQualityMatchReason,
  matchScoreLabelFor,
  usableKeywordSummary,
} from "@/lib/match-score";
import type { RoleTitlePreferences } from "@/lib/role-title-preferences";
import {
  applyRoleTitlePreferenceToScore,
  roleTitlePreferenceReasons,
} from "@/lib/role-title-preferences";

export type NetworkJobMatchFields = {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills: string[];
  gapSkills: string[];
  matchRank?: number;
};

export type NetworkMatchedJob = NetworkJobListing & NetworkJobMatchFields;

function vectorRankScore(rank: number, total: number): number {
  if (total <= 1) return 92;
  const spread = Math.min(total - 1, 19);
  return Math.max(58, Math.round(94 - ((rank - 1) * 32) / Math.max(spread, 1)));
}

export function networkJobDescriptionForMatch(job: NetworkJobListing): string {
  const parts = [
    job.positionTitle,
    job.companyName,
    job.description,
    job.recruiterNotes ? `Recruiter notes:\n${job.recruiterNotes}` : null,
    job.industries.length ? `Industries: ${job.industries.join(", ")}` : null,
    job.jobType ? `Job type: ${job.jobType}` : null,
    job.remoteOption ? `Workplace: ${job.remoteOption}` : null,
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 2000);
}

const EMPTY_MATCH: NetworkJobMatchFields = {
  matchScore: 0,
  matchLabel: "",
  matchReasons: [],
  matchedSkills: [],
  gapSkills: [],
};

export function enrichNetworkJobsWithMatch(
  jobs: NetworkJobListing[],
  resumeText: string,
  roleTitlePreferences: RoleTitlePreferences = {},
): NetworkMatchedJob[] {
  const targetRoles = roleTitlePreferences.targetRoles ?? [];
  const rolesLine = targetRoles.map((r) => r.trim()).filter(Boolean).join(", ");
  const profileText = [resumeText.trim(), rolesLine].filter(Boolean).join("\n");
  if (!profileText || !jobs.length) {
    return jobs.map((job) => ({ ...job, ...EMPTY_MATCH }));
  }

  const resumeLower = profileText.toLowerCase();
  const ranked = jobs
    .map((job) => {
      const fallback = fallbackJobMatch(networkJobDescriptionForMatch(job), profileText);
      return { job, fallback, keywordScore: Math.round(fallback.score * 10) };
    })
    .sort((a, b) => b.keywordScore - a.keywordScore);

  return ranked.map(({ job, fallback, keywordScore }, index) => {
    const rank = index + 1;
    const rankScore = vectorRankScore(rank, ranked.length);
    const baseScore = Math.round(rankScore * 0.55 + keywordScore * 0.45);
    const { matchScore, adjustment } = applyRoleTitlePreferenceToScore(
      baseScore,
      job.positionTitle,
      roleTitlePreferences,
    );

    const industryMatches = job.industries.filter((industry) =>
      resumeLower.includes(industry.toLowerCase()),
    );
    const keywordMatches = fallback.keywords.filter((k) => k.matched).map((k) => k.text);
    const matchedSkills = [...new Set([...industryMatches, ...keywordMatches])].slice(0, 8);
    const gapSkills = job.industries
      .filter((industry) => !resumeLower.includes(industry.toLowerCase()))
      .slice(0, 4);

    const reasons: string[] = [];
    reasons.push(...roleTitlePreferenceReasons(adjustment));
    if (matchedSkills.length) {
      reasons.push(
        `You're a good fit because your background aligns with ${matchedSkills.slice(0, 4).join(", ")}.`,
      );
    }
    if (job.remoteOption?.toLowerCase().includes("remote") && resumeLower.includes("remote")) {
      reasons.push("Remote flexibility matches what you've highlighted in your profile.");
    }
    const keywordNote =
      usableKeywordSummary(
        fallback.keywords.filter((k) => k.matched).length,
        fallback.keywords.length,
      ) ??
      (fallback.summaryNote && !isLowQualityMatchReason(fallback.summaryNote)
        ? fallback.summaryNote
        : null);
    if (keywordNote && reasons.length < 2) reasons.push(keywordNote);
    if (!reasons.length) {
      reasons.push(
        "This recruiter-network role surfaced from your profile — open it to review fit and recruiter notes.",
      );
    }

    return {
      ...job,
      matchScore,
      matchLabel: matchScoreLabelFor(matchScore),
      matchReasons: reasons.slice(0, 4),
      matchedSkills,
      gapSkills,
      matchRank: rank,
    };
  });
}

export function enrichNetworkJobWithMatch(
  job: NetworkJobListing,
  resumeText: string,
  roleTitlePreferences: RoleTitlePreferences = {},
): NetworkMatchedJob {
  return enrichNetworkJobsWithMatch([job], resumeText, roleTitlePreferences)[0]!;
}
