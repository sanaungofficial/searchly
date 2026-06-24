/** Shared role-matching helpers for watchlist job scans. */

const ROLE_STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "lead",
  "head",
  "senior",
  "staff",
  "principal",
  "vice",
  "president",
  "of",
  "and",
]);

export function parseRolesText(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text.split(/[,;\n]+/).map((r) => r.trim()).filter(Boolean);
}

export function buildMatchRoles(profileRoles: string[], companyTargetRoles: string | null): string[] {
  const seen = new Set<string>();
  return [...profileRoles, ...parseRolesText(companyTargetRoles)].filter((role) => {
    const key = role.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Keywords for Hirebase `keywords` filter — broader than full job titles. */
export function roleSearchKeywords(matchRoles: string[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const role of matchRoles) {
    const normalized = role.trim().toLowerCase();
    if (normalized.length >= 4 && !seen.has(normalized)) {
      seen.add(normalized);
      keywords.push(normalized);
    }

    for (const word of normalized.split(/\s+/)) {
      const w = word.replace(/[^a-z0-9+#]/g, "");
      if (w.length >= 3 && !ROLE_STOP_WORDS.has(w) && !seen.has(w)) {
        seen.add(w);
        keywords.push(w);
      }
    }
  }

  return keywords.slice(0, 12);
}

export function isJobMatch(
  jobTitle: string,
  matchRoles: string[],
  department?: string | null
): boolean {
  if (!matchRoles.length) return false;
  const haystack = `${jobTitle} ${department ?? ""}`.toLowerCase();

  if (
    matchRoles.some((role) => {
      const phrase = role.trim().toLowerCase();
      return phrase.length >= 4 && haystack.includes(phrase);
    })
  ) {
    return true;
  }

  return matchRoles.some((role) => {
    const words = role
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9+#]/g, ""))
      .filter((w) => w.length >= 3 && !ROLE_STOP_WORDS.has(w));

    if (!words.length) return false;
    return words.some((w) => haystack.includes(w));
  });
}

export function hasMatchRoles(profileRoles: string[], companyTargetRoles: string | null): boolean {
  return buildMatchRoles(profileRoles, companyTargetRoles).length > 0;
}

export function dedupeJobs<T extends { url: string | null; title: string }>(jobs: T[]): T[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = (job.url ?? job.title).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterMatchingJobs<T extends { title: string; department?: string | null; url: string | null }>(
  jobs: T[],
  matchRoles: string[],
  maxJobs: number
): T[] {
  return dedupeJobs(jobs.filter((job) => isJobMatch(job.title, matchRoles, job.department))).slice(0, maxJobs);
}
