import {
  isApifyConfigured,
  mapApifyProfileToParsedData,
  scrapeLinkedInProfile,
} from "@/lib/apify-linkedin";
import { tierFromScore } from "@/lib/discovery-score";
import { unifiedTargetRoles } from "@/lib/target-roles-unified";
import { benchmarkPeerLabel, type DiscoveryBenchmarkResolution } from "./benchmark-role";
import type {
  DiscoveryBenchmarkProfile,
  DiscoveryProfileContext,
  DiscoveryScoreCachePayload,
  EnrichedBenchmark,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseYear(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export function estimateExperienceYears(
  workExperience: Array<{ from?: string | null; to?: string | null }> | undefined,
): number {
  if (!workExperience?.length) return 0;
  const starts = workExperience.map((e) => parseYear(e.from)).filter((y): y is number => y != null);
  const ends = workExperience.map((e) => (e.to?.toLowerCase() === "present" ? new Date().getFullYear() : parseYear(e.to)))
    .filter((y): y is number => y != null);
  if (!starts.length) return workExperience.length * 1.5;
  const earliest = Math.min(...starts);
  const latest = ends.length ? Math.max(...ends) : new Date().getFullYear();
  return Math.max(0, latest - earliest);
}

function apifyFallbackParsedFromSumble(benchmark: DiscoveryBenchmarkProfile): EnrichedBenchmark {
  return {
    ...benchmark,
    skills: [],
    experienceYears: 0,
    experienceEntries: 0,
  };
}

export async function enrichBenchmarksWithApify(
  benchmarks: DiscoveryBenchmarkProfile[],
  userId: string,
): Promise<EnrichedBenchmark[]> {
  if (!isApifyConfigured()) {
    return benchmarks.map(apifyFallbackParsedFromSumble);
  }

  const enriched = await Promise.all(
    benchmarks.map(async (benchmark) => {
      if (!benchmark.linkedinUrl) return apifyFallbackParsedFromSumble(benchmark);
      try {
        const profile = await scrapeLinkedInProfile(benchmark.linkedinUrl, { userId });
        const parsed = mapApifyProfileToParsedData(profile);
        const current = parsed.workExperience[0];
        return {
          ...benchmark,
          thumbnailUrl: benchmark.thumbnailUrl ?? profile.picture ?? null,
          title: benchmark.title ?? current?.title ?? null,
          company: benchmark.company ?? current?.company ?? null,
          skills: [...parsed.skills, ...parsed.tools].map((s) => s.trim()).filter(Boolean),
          experienceYears: estimateExperienceYears(parsed.workExperience),
          experienceEntries: parsed.workExperience.length,
        };
      } catch {
        return apifyFallbackParsedFromSumble(benchmark);
      }
    }),
  );

  return enriched;
}

function userSkills(ctx: DiscoveryProfileContext): string[] {
  return [...(ctx.parsedData?.skills ?? []), ...(ctx.parsedData?.tools ?? [])]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function userExperienceYears(ctx: DiscoveryProfileContext): number {
  return estimateExperienceYears(ctx.parsedData?.workExperience);
}

function compositeScore(input: {
  skillsCount: number;
  experienceYears: number;
  experienceEntries: number;
  educationCount: number;
  hasLinkedIn: boolean;
  headlineLength: number;
}): number {
  const skillPts = Math.min(input.skillsCount, 20) * 2.5;
  const expPts = Math.min(input.experienceYears, 15) * 2;
  const depthPts = Math.min(input.experienceEntries, 6) * 3;
  const eduPts = Math.min(input.educationCount, 3) * 4;
  const linkedInPts = input.hasLinkedIn ? 8 : 0;
  const headlinePts = Math.min(input.headlineLength, 80) / 4;
  return clamp(skillPts + expPts + depthPts + eduPts + linkedInPts + headlinePts, 0, 100);
}

function buildBreakdown(
  user: ReturnType<typeof userMetrics>,
  cohortAvg: ReturnType<typeof userMetrics>,
): DiscoveryScoreCachePayload["breakdown"] {
  const ratio = (userVal: number, cohortVal: number, max: number) =>
    clamp(cohortVal > 0 ? (userVal / cohortVal) * (max * 0.65) + max * 0.15 : max * 0.35, 0, max);

  return {
    resumeStrength: ratio(user.experienceYears + user.experienceEntries, cohortAvg.experienceYears + cohortAvg.experienceEntries, 25),
    positioningClarity: ratio(user.skillsCount + user.headlineLength / 10, cohortAvg.skillsCount + cohortAvg.headlineLength / 10, 25),
    marketReadiness: ratio(user.educationCount + (user.hasLinkedIn ? 2 : 0), cohortAvg.educationCount + (cohortAvg.hasLinkedIn ? 2 : 0), 25),
    competitiveSignals: ratio(user.skillsCount + user.experienceEntries, cohortAvg.skillsCount + cohortAvg.experienceEntries, 25),
  };
}

function userMetrics(ctx: DiscoveryProfileContext) {
  return {
    skillsCount: userSkills(ctx).length,
    experienceYears: userExperienceYears(ctx),
    experienceEntries: ctx.parsedData?.workExperience?.length ?? 0,
    educationCount: ctx.parsedData?.education?.length ?? 0,
    hasLinkedIn: Boolean(ctx.linkedinUrl?.trim()),
    headlineLength: (ctx.headline ?? "").trim().length,
  };
}

function benchmarkMetrics(benchmark: EnrichedBenchmark) {
  return {
    skillsCount: benchmark.skills.length,
    experienceYears: benchmark.experienceYears,
    experienceEntries: benchmark.experienceEntries,
    educationCount: 0,
    hasLinkedIn: true,
    headlineLength: (benchmark.title ?? "").length,
  };
}

function averageMetrics(metrics: ReturnType<typeof userMetrics>[]) {
  if (!metrics.length) {
    return {
      skillsCount: 8,
      experienceYears: 6,
      experienceEntries: 3,
      educationCount: 1,
      hasLinkedIn: true,
      headlineLength: 40,
    };
  }
  const sum = metrics.reduce(
    (acc, m) => ({
      skillsCount: acc.skillsCount + m.skillsCount,
      experienceYears: acc.experienceYears + m.experienceYears,
      experienceEntries: acc.experienceEntries + m.experienceEntries,
      educationCount: acc.educationCount + m.educationCount,
      hasLinkedIn: acc.hasLinkedIn || m.hasLinkedIn,
      headlineLength: acc.headlineLength + m.headlineLength,
    }),
    {
      skillsCount: 0,
      experienceYears: 0,
      experienceEntries: 0,
      educationCount: 0,
      hasLinkedIn: false,
      headlineLength: 0,
    },
  );
  const n = metrics.length;
  return {
    skillsCount: sum.skillsCount / n,
    experienceYears: sum.experienceYears / n,
    experienceEntries: sum.experienceEntries / n,
    educationCount: sum.educationCount / n,
    hasLinkedIn: sum.hasLinkedIn,
    headlineLength: sum.headlineLength / n,
  };
}

function skillInsights(ctx: DiscoveryProfileContext, cohort: EnrichedBenchmark[]) {
  const counts = new Map<string, number>();
  for (const person of cohort) {
    for (const skill of person.skills) {
      const key = skill.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const userSkillSet = new Set(userSkills(ctx));
  const threshold = Math.max(2, Math.ceil(cohort.length * 0.35));
  const gaps: string[] = [];
  const strengths: string[] = [];

  for (const [skill, count] of counts) {
    if (count >= threshold && !userSkillSet.has(skill)) gaps.push(skill);
  }
  for (const skill of userSkillSet) {
    const count = counts.get(skill) ?? 0;
    if (count <= Math.floor(cohort.length * 0.25)) strengths.push(skill);
  }

  return {
    gaps: gaps.slice(0, 5).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())),
    strengths: strengths.slice(0, 5).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())),
  };
}

export function computeDiscoveryScoreFromCohort(
  ctx: DiscoveryProfileContext,
  cohort: EnrichedBenchmark[],
  benchmark?: DiscoveryBenchmarkResolution,
  _queryUsed?: string | null,
): Omit<
  DiscoveryScoreCachePayload,
  | "version"
  | "fingerprint"
  | "refreshedAt"
  | "benchmarkTargetRole"
  | "benchmarkPeerLabel"
  | "benchmarkJobFunction"
  | "benchmarkQuery"
> {
  const user = userMetrics(ctx);
  const cohortMetricList = cohort.map(benchmarkMetrics);
  const cohortAvg = averageMetrics(cohortMetricList);
  const userScore = compositeScore(user);
  const cohortScores = cohortMetricList.map((m) => compositeScore(m));
  const beatCount = cohortScores.filter((score) => userScore >= score).length;
  const percentile = cohortScores.length ? clamp((beatCount / cohortScores.length) * 100, 0, 100) : 50;
  const breakdown = buildBreakdown(user, cohortAvg);
  const score = breakdown.resumeStrength + breakdown.positioningClarity + breakdown.marketReadiness + breakdown.competitiveSignals;
  const { strengths, gaps } = skillInsights(ctx, cohort);
  const orderedRoles = unifiedTargetRoles({
    targetRoles: ctx.targetRoles,
    prioritizedRoles: ctx.prioritizedRoles,
  });
  const resolution = benchmark ?? {
    targetRoleLabel: orderedRoles[0] ?? "similar roles",
    hirebaseCategory: ctx.prioritizedCategories[0] ?? null,
    sumbleJobFunction: null,
    sumbleJobLevel: null,
    titleTokens: [],
    source: "target_role_only" as const,
  };
  const peerLabel = benchmarkPeerLabel(resolution);
  const location = ctx.location?.split(",")[0]?.trim();

  const summary = location
    ? `You rank in the ${percentile >= 80 ? "top tier" : percentile >= 55 ? "upper half" : "building range"} among ${peerLabel} professionals in ${location}.`
    : `You rank in the ${percentile >= 80 ? "top tier" : percentile >= 55 ? "upper half" : "building range"} among ${peerLabel} professionals.`;

  const topImprovement =
    gaps[0]
      ? `Add ${gaps[0]} to your profile — it appears frequently among peers in your target roles.`
      : strengths[0]
        ? `Lead with ${strengths[0]} in your headline and summary to differentiate from the cohort.`
        : "Complete your target roles, skills, and location to unlock a sharper benchmark comparison.";

  return {
    score,
    percentile,
    tier: tierFromScore(score),
    summary,
    strengths,
    gaps,
    topImprovement,
    breakdown,
    benchmarks: cohort.map(({ skills: _s, experienceYears: _y, experienceEntries: _e, ...rest }) => rest),
  };
}
