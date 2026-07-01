import type { DiscoveryProfileContext } from "./types";

function escapeQueryTerm(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

export function buildSumblePeopleQuery(ctx: DiscoveryProfileContext): string | null {
  const clauses: string[] = [];
  const roles = ctx.prioritizedRoles.length ? ctx.prioritizedRoles : ctx.targetRoles;

  if (roles.length) {
    const titleParts = roles
      .slice(0, 3)
      .map((role) => {
        const term = escapeQueryTerm(role);
        return term ? `job_title CONTAINS "${term}"` : null;
      })
      .filter(Boolean);
    if (titleParts.length) clauses.push(`(${titleParts.join(" OR ")})`);
  }

  const skills = [...(ctx.parsedData?.skills ?? []), ...(ctx.parsedData?.tools ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (skills.length) {
    const techParts = skills
      .map((skill) => {
        const term = escapeQueryTerm(skill);
        return term ? `technology EQ "${term}"` : null;
      })
      .filter(Boolean);
    if (techParts.length) clauses.push(`(${techParts.join(" OR ")})`);
  }

  const location = ctx.location?.trim();
  if (location) {
    const term = escapeQueryTerm(location.split(",")[0] ?? location);
    if (term) clauses.push(`location CONTAINS "${term}"`);
  }

  if (!clauses.length) return null;
  return clauses.join(" AND ");
}
