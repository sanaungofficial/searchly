/** URL slug helpers for coach marketplace profiles. */

export function slugifyDisplayName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function coachProfileSlug(displayName: string, id: string): string {
  const base = slugifyDisplayName(displayName) || "coach";
  return `${base}-${id.slice(-6)}`;
}
