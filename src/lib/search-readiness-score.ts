/**
 * Search Readiness Score — a 0-100 composite score telling job seekers
 * how prepared they are to land their next role.
 *
 * Profile-based only (no activity tracking). Weighted by impact on
 * search outcomes.
 */

export type SearchReadinessInput = {
  name?: string | null;
  email?: string | null;
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  jobTimeline?: string | null;
  targetSalary?: string | null;
  priorities?: string[];
  targetRoles?: string[];
  careerMotivation?: string | null;
  headline?: string | null;
  hasStrategy?: boolean;
  parsedData?: {
    phone?: string | null;
    location?: string | null;
    education?: unknown[];
    workExperience?: unknown[];
    skills?: unknown[];
    tools?: unknown[];
  } | null;
};

export type ScoreBreakdownItem = {
  id: string;
  label: string;
  maxPoints: number;
  earnedPoints: number;
  complete: boolean;
  action: string;
  /** Which profile tab to navigate to */
  tab: string;
};

export type SearchReadinessResult = {
  score: number;
  tier: "beginner" | "building" | "strong" | "ready";
  tierLabel: string;
  breakdown: ScoreBreakdownItem[];
};

export function computeSearchReadiness(input: SearchReadinessInput): SearchReadinessResult {
  const breakdown: ScoreBreakdownItem[] = [];

  // Resume (25 pts) — most impactful
  const hasResume = Boolean(input.resumeUrl?.trim());
  breakdown.push({
    id: "resume",
    label: "Upload your resume",
    maxPoints: 25,
    earnedPoints: hasResume ? 25 : 0,
    complete: hasResume,
    action: "Upload resume",
    tab: "assets",
  });

  // Target roles (15 pts) — essential for matching
  const hasRoles = (input.targetRoles ?? []).length > 0;
  breakdown.push({
    id: "target_roles",
    label: "Set your target roles",
    maxPoints: 15,
    earnedPoints: hasRoles ? 15 : 0,
    complete: hasRoles,
    action: "Choose target roles",
    tab: "preferences",
  });

  // LinkedIn (15 pts)
  const hasLinkedin = Boolean(input.linkedinUrl?.trim());
  breakdown.push({
    id: "linkedin",
    label: "Add your LinkedIn URL",
    maxPoints: 15,
    earnedPoints: hasLinkedin ? 15 : 0,
    complete: hasLinkedin,
    action: "Add LinkedIn",
    tab: "linkedin",
  });

  // Work experience (10 pts)
  const hasExperience = ((input.parsedData?.workExperience as unknown[]) ?? []).length > 0;
  breakdown.push({
    id: "experience",
    label: "Add work experience",
    maxPoints: 10,
    earnedPoints: hasExperience ? 10 : 0,
    complete: hasExperience,
    action: "Add experience",
    tab: "about",
  });

  // Skills (8 pts)
  const hasSkills =
    ((input.parsedData?.skills as unknown[]) ?? []).length > 0 ||
    ((input.parsedData?.tools as unknown[]) ?? []).length > 0;
  breakdown.push({
    id: "skills",
    label: "Add your skills",
    maxPoints: 8,
    earnedPoints: hasSkills ? 8 : 0,
    complete: hasSkills,
    action: "Add skills",
    tab: "about",
  });

  // Target salary (7 pts)
  const hasSalary = Boolean(input.targetSalary?.trim());
  breakdown.push({
    id: "salary",
    label: "Set target salary",
    maxPoints: 7,
    earnedPoints: hasSalary ? 7 : 0,
    complete: hasSalary,
    action: "Set salary range",
    tab: "preferences",
  });

  // Job timeline (5 pts)
  const hasTimeline = Boolean(input.jobTimeline?.trim());
  breakdown.push({
    id: "timeline",
    label: "Set your job timeline",
    maxPoints: 5,
    earnedPoints: hasTimeline ? 5 : 0,
    complete: hasTimeline,
    action: "Set timeline",
    tab: "preferences",
  });

  // Location (5 pts)
  const hasLocation = Boolean(input.parsedData?.location);
  breakdown.push({
    id: "location",
    label: "Add your location",
    maxPoints: 5,
    earnedPoints: hasLocation ? 5 : 0,
    complete: hasLocation,
    action: "Add location",
    tab: "about",
  });

  // Headline (5 pts)
  const hasHeadline = Boolean(input.headline?.trim());
  breakdown.push({
    id: "headline",
    label: "Write a headline",
    maxPoints: 5,
    earnedPoints: hasHeadline ? 5 : 0,
    complete: hasHeadline,
    action: "Add headline",
    tab: "about",
  });

  // Career strategy (5 pts)
  const hasStrategy = Boolean(input.hasStrategy);
  breakdown.push({
    id: "strategy",
    label: "Generate career strategy",
    maxPoints: 5,
    earnedPoints: hasStrategy ? 5 : 0,
    complete: hasStrategy,
    action: "Generate strategy",
    tab: "strategy",
  });

  const score = breakdown.reduce((sum, item) => sum + item.earnedPoints, 0);

  let tier: SearchReadinessResult["tier"];
  let tierLabel: string;
  if (score >= 80) {
    tier = "ready";
    tierLabel = "Search Ready";
  } else if (score >= 55) {
    tier = "strong";
    tierLabel = "Getting Strong";
  } else if (score >= 25) {
    tier = "building";
    tierLabel = "Building Up";
  } else {
    tier = "beginner";
    tierLabel = "Just Starting";
  }

  return { score, tier, tierLabel, breakdown };
}

export function topIncompleteItems(result: SearchReadinessResult, max = 3): ScoreBreakdownItem[] {
  return result.breakdown
    .filter((item) => !item.complete)
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, max);
}
