/** Profile-driven title/category boosts/penalties — reorder only, never filter. */

export type RoleTitlePreferences = {
  targetRoles?: string[];
  prioritizedRoles?: string[];
  prioritizedCategories?: string[];
  deprioritizedRoles?: string[];
  deprioritizedCategories?: string[];
};

export type RoleTitlePreferenceAdjustment = {
  boost: number;
  penalty: number;
  netAdjustment: number;
  preferredMatch?: string;
  prioritizedMatch?: string;
  prioritizedCategoryMatch?: string;
  deprioritizedMatch?: string;
  deprioritizedCategoryMatch?: string;
};

/** Boost when job title matches a target role (Profile → Dream roles). */
export const TARGET_ROLE_TITLE_BOOST = 15;

/** Stronger boost for explicitly prioritized role patterns (Hirebase-backed list). */
export const PRIORITIZED_ROLE_TITLE_BOOST = 20;

/** Boost when a job's Hirebase category matches a prioritized category. */
export const PRIORITIZED_CATEGORY_BOOST = 12;

/** Penalty when job title matches a deprioritized pattern — sorts lower, still visible. */
export const DEPRIORITIZED_ROLE_TITLE_PENALTY = 28;

/** Penalty when a job's Hirebase category matches a deprioritized category. */
export const DEPRIORITIZED_CATEGORY_PENALTY = 20;

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

/** Match job titles against user-entered role/pattern strings.
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

/** Long deprioritized labels — match significant consecutive token pairs (e.g. "Product Management" in a Hirebase title). */
function deprioritizedPatternMatchesTitle(jobTitle: string, pattern: string): boolean {
  if (jobTitleMatchesRolePattern(jobTitle, pattern)) return true;

  const parts = splitTitleTokens(pattern);
  if (parts.length < 3) return false;

  for (let i = 0; i < parts.length - 1; i++) {
    const pair = `${parts[i]} ${parts[i + 1]}`;
    if (pair.length >= 7 && jobTitleMatchesRolePattern(jobTitle, pair)) return true;
  }

  return false;
}

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

/** Match Hirebase category labels (exact or substring). */
export function jobCategoryMatchesPattern(jobCategories: string[], pattern: string): boolean {
  const needle = normalizeCategory(pattern);
  if (!needle) return false;
  return jobCategories.some((cat) => {
    const hay = normalizeCategory(cat);
    if (!hay) return false;
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
}

export function adjustMatchScoreForRoleTitlePreferences(
  jobTitle: string,
  preferences: RoleTitlePreferences,
  jobCategories: string[] = [],
): RoleTitlePreferenceAdjustment {
  let boost = 0;
  let penalty = 0;
  let preferredMatch: string | undefined;
  let prioritizedMatch: string | undefined;
  let prioritizedCategoryMatch: string | undefined;
  let deprioritizedMatch: string | undefined;
  let deprioritizedCategoryMatch: string | undefined;

  for (const role of preferences.prioritizedRoles ?? []) {
    const trimmed = role.trim();
    if (!trimmed) continue;
    if (jobTitleMatchesRolePattern(jobTitle, trimmed)) {
      boost = Math.max(boost, PRIORITIZED_ROLE_TITLE_BOOST);
      prioritizedMatch = trimmed;
    }
  }

  for (const role of preferences.targetRoles ?? []) {
    const trimmed = role.trim();
    if (!trimmed) continue;
    if (jobTitleMatchesRolePattern(jobTitle, trimmed)) {
      boost = Math.max(boost, TARGET_ROLE_TITLE_BOOST);
      preferredMatch = trimmed;
    }
  }

  for (const category of preferences.prioritizedCategories ?? []) {
    const trimmed = category.trim();
    if (!trimmed) continue;
    if (jobCategoryMatchesPattern(jobCategories, trimmed)) {
      boost = Math.max(boost, PRIORITIZED_CATEGORY_BOOST);
      prioritizedCategoryMatch = trimmed;
    }
  }

  for (const pattern of preferences.deprioritizedRoles ?? []) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;
    if (deprioritizedPatternMatchesTitle(jobTitle, trimmed)) {
      penalty = Math.max(penalty, DEPRIORITIZED_ROLE_TITLE_PENALTY);
      deprioritizedMatch = trimmed;
    }
  }

  for (const category of preferences.deprioritizedCategories ?? []) {
    const trimmed = category.trim();
    if (!trimmed) continue;
    if (jobCategoryMatchesPattern(jobCategories, trimmed)) {
      penalty = Math.max(penalty, DEPRIORITIZED_CATEGORY_PENALTY);
      deprioritizedCategoryMatch = trimmed;
    }
  }

  return {
    boost,
    penalty,
    netAdjustment: boost - penalty,
    preferredMatch,
    prioritizedMatch,
    prioritizedCategoryMatch,
    deprioritizedMatch,
    deprioritizedCategoryMatch,
  };
}

export function applyRoleTitlePreferenceToScore(
  baseScore: number,
  jobTitle: string,
  preferences: RoleTitlePreferences,
  jobCategories: string[] = [],
): { matchScore: number; adjustment: RoleTitlePreferenceAdjustment } {
  const adjustment = adjustMatchScoreForRoleTitlePreferences(jobTitle, preferences, jobCategories);
  const matchScore = Math.min(100, Math.max(0, Math.round(baseScore + adjustment.netAdjustment)));
  return { matchScore, adjustment };
}

export function roleTitlePreferenceReasons(adjustment: RoleTitlePreferenceAdjustment): string[] {
  const reasons: string[] = [];
  if (adjustment.prioritizedMatch) {
    reasons.push(`Matches your prioritized role: ${adjustment.prioritizedMatch}.`);
  } else if (adjustment.preferredMatch) {
    reasons.push(`Matches your target role: ${adjustment.preferredMatch}.`);
  }
  if (adjustment.prioritizedCategoryMatch) {
    reasons.push(`Category boost — ${adjustment.prioritizedCategoryMatch}.`);
  }
  if (adjustment.deprioritizedMatch) {
    reasons.push(
      `Sorted lower — title relates to your deprioritized pattern (${adjustment.deprioritizedMatch}).`,
    );
  }
  if (adjustment.deprioritizedCategoryMatch) {
    reasons.push(
      `Sorted lower — category matches your deprioritized bucket (${adjustment.deprioritizedCategoryMatch}).`,
    );
  }
  return reasons;
}

type ProfileRoleFields = {
  targetRoles?: string[];
  prioritizedRoles?: string[];
  prioritizedCategories?: string[];
  deprioritizedRoles?: string[];
  deprioritizedCategories?: string[];
};

/** Normalize profile role-preference fields for ranking (Open + In-network). */
export function buildRoleTitlePreferencesFromProfile(
  profile: ProfileRoleFields | null | undefined,
): RoleTitlePreferences {
  return {
    targetRoles: (profile?.targetRoles ?? []).slice(0, 30),
    prioritizedRoles: (profile?.prioritizedRoles ?? []).slice(0, 30),
    prioritizedCategories: (profile?.prioritizedCategories ?? []).slice(0, 20),
    deprioritizedRoles: (profile?.deprioritizedRoles ?? []).slice(0, 30),
    deprioritizedCategories: (profile?.deprioritizedCategories ?? []).slice(0, 20),
  };
}

/** Role titles used for keyword/resume matching — prioritized first, then targets. */
export function profileRoleTitlesForMatch(preferences: RoleTitlePreferences): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const role of [...(preferences.prioritizedRoles ?? []), ...(preferences.targetRoles ?? [])]) {
    const trimmed = role.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function hasRoleTitlePreferenceSignals(preferences: RoleTitlePreferences): boolean {
  return (
    (preferences.prioritizedRoles?.length ?? 0) > 0 ||
    (preferences.targetRoles?.length ?? 0) > 0 ||
    (preferences.prioritizedCategories?.length ?? 0) > 0 ||
    (preferences.deprioritizedRoles?.length ?? 0) > 0 ||
    (preferences.deprioritizedCategories?.length ?? 0) > 0
  );
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

export const PRIORITIZED_ROLE_SUGGESTIONS: string[] = [
  "Commercial Product Lead",
  "GTM Operations Manager",
  "Revenue Operations Manager",
  "General Manager",
  "Network Operations Manager",
  "Commercial Strategy Lead",
];

export const DEPRIORITIZED_CATEGORY_SUGGESTIONS: string[] = [
  "Sales Jobs",
  "Product Jobs",
  "Business Development Jobs",
];

export const PRIORITIZED_CATEGORY_SUGGESTIONS: string[] = [
  "Operations Jobs",
  "Project Management Jobs",
  "Consulting Jobs",
];
