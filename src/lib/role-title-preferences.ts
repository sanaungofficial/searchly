/** Profile-driven title boosts/penalties — reorder only, never filter. */

export type RoleTitlePreferences = {
  targetRoles?: string[];
  deprioritizedRoles?: string[];
};

export type RoleTitlePreferenceAdjustment = {
  boost: number;
  penalty: number;
  netAdjustment: number;
  preferredMatch?: string;
  deprioritizedMatch?: string;
};

/** Boost when job title matches a target role (Profile → Dream roles). */
export const TARGET_ROLE_TITLE_BOOST = 15;

/** Penalty when job title matches a deprioritized pattern — sorts lower, still visible. */
export const DEPRIORITIZED_ROLE_TITLE_PENALTY = 22;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match job titles against user-entered role/pattern strings (substring or word boundary for short tokens). */
export function jobTitleMatchesRolePattern(jobTitle: string, pattern: string): boolean {
  const haystack = normalizeToken(jobTitle);
  const needle = normalizeToken(pattern);
  if (!needle || needle.length < 2) return false;

  if (haystack.includes(needle)) return true;

  if (needle.length <= 4) {
    return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(jobTitle);
  }

  return false;
}

export function adjustMatchScoreForRoleTitlePreferences(
  jobTitle: string,
  preferences: RoleTitlePreferences,
): RoleTitlePreferenceAdjustment {
  let boost = 0;
  let penalty = 0;
  let preferredMatch: string | undefined;
  let deprioritizedMatch: string | undefined;

  for (const role of preferences.targetRoles ?? []) {
    const trimmed = role.trim();
    if (!trimmed) continue;
    if (jobTitleMatchesRolePattern(jobTitle, trimmed)) {
      boost = TARGET_ROLE_TITLE_BOOST;
      preferredMatch = trimmed;
      break;
    }
  }

  for (const pattern of preferences.deprioritizedRoles ?? []) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;
    if (jobTitleMatchesRolePattern(jobTitle, trimmed)) {
      penalty = DEPRIORITIZED_ROLE_TITLE_PENALTY;
      deprioritizedMatch = trimmed;
      break;
    }
  }

  return {
    boost,
    penalty,
    netAdjustment: boost - penalty,
    preferredMatch,
    deprioritizedMatch,
  };
}

export function applyRoleTitlePreferenceToScore(
  baseScore: number,
  jobTitle: string,
  preferences: RoleTitlePreferences,
): { matchScore: number; adjustment: RoleTitlePreferenceAdjustment } {
  const adjustment = adjustMatchScoreForRoleTitlePreferences(jobTitle, preferences);
  const matchScore = Math.min(100, Math.max(0, Math.round(baseScore + adjustment.netAdjustment)));
  return { matchScore, adjustment };
}

export function roleTitlePreferenceReasons(adjustment: RoleTitlePreferenceAdjustment): string[] {
  const reasons: string[] = [];
  if (adjustment.preferredMatch) {
    reasons.push(`Matches your target role: ${adjustment.preferredMatch}.`);
  }
  if (adjustment.deprioritizedMatch) {
    reasons.push(
      `Sorted lower — matches a role you asked to deprioritize (${adjustment.deprioritizedMatch}).`,
    );
  }
  return reasons;
}

/** UI quick-add suggestions only — not applied unless saved on the profile. */
export const DEPRIORITIZED_ROLE_SUGGESTIONS: string[] = [
  "Account Executive",
  "Sales Development Representative",
  "Product Manager",
  "Product Owner",
  "Partnerships Manager",
  "Business Development Representative",
];
