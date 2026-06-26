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
export const DEPRIORITIZED_ROLE_TITLE_PENALTY = 28;

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

/** Related title words — e.g. Product Manager deprioritizes Product Management. */
const TOKEN_EQUIVALENTS: Record<string, string[]> = {
  manager: ["manager", "management", "mgr"],
  management: ["manager", "management", "mgr"],
  executive: ["executive", "exec"],
  representative: ["representative", "rep"],
  developer: ["developer", "development", "dev"],
  development: ["developer", "development", "dev"],
  owner: ["owner", "ownership"],
  ownership: ["owner", "ownership"],
  engineer: ["engineer", "engineering"],
  engineering: ["engineer", "engineering"],
  sales: ["sales", "selling"],
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitTitleTokens(value: string): string[] {
  return normalizeToken(value)
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length >= 2 && !TITLE_STOP_WORDS.has(t));
}

function expandToken(token: string): string[] {
  const lower = token.toLowerCase();
  const group = TOKEN_EQUIVALENTS[lower];
  if (group) return [...new Set([lower, ...group])];
  return [lower];
}

function titleTokenSet(jobTitle: string): Set<string> {
  const expanded = splitTitleTokens(jobTitle).flatMap(expandToken);
  return new Set(expanded);
}

/** All significant pattern tokens must appear in the title (with word-family equivalents). */
function patternTokensMatchTitle(pattern: string, jobTitle: string): boolean {
  const patternParts = splitTitleTokens(pattern);
  if (!patternParts.length) return false;

  const titleTokens = titleTokenSet(jobTitle);
  return patternParts.every((part) => expandToken(part).some((variant) => titleTokens.has(variant)));
}

/**
 * Match job titles against user-entered role/pattern strings.
 * Uses substring first, then token families (manager ↔ management, etc.).
 */
export function jobTitleMatchesRolePattern(jobTitle: string, pattern: string): boolean {
  const haystack = normalizeToken(jobTitle);
  const needle = normalizeToken(pattern);
  if (!needle || needle.length < 2) return false;

  if (haystack.includes(needle)) return true;

  if (needle.length <= 4) {
    if (new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(jobTitle)) return true;
  }

  if (splitTitleTokens(pattern).length >= 2) {
    return patternTokensMatchTitle(pattern, jobTitle);
  }

  const single = splitTitleTokens(pattern)[0];
  if (!single) return false;
  return expandToken(single).some((variant) => titleTokenSet(jobTitle).has(variant));
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
      `Sorted lower — title relates to your deprioritized pattern (${adjustment.deprioritizedMatch}).`,
    );
  }
  return reasons;
}

/** UI quick-add suggestions only — not applied unless saved on the profile. */
export const DEPRIORITIZED_ROLE_SUGGESTIONS: string[] = [
  "Account Executive",
  "Sales Development Representative",
  "Product Manager",
  "Product Management",
  "Product Owner",
  "Partnerships Manager",
  "Business Development Representative",
];
