/** Shared role-matching helpers for watchlist job scans. */

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

export function isJobMatch(jobTitle: string, matchRoles: string[]): boolean {
  if (!matchRoles.length) return false;
  const title = jobTitle.toLowerCase();
  return matchRoles.some((role) =>
    role
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .some((w) => title.includes(w))
  );
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
