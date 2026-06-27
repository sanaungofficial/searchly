/** URL slug helpers for coach marketplace profiles. */

import { prisma } from "@/lib/prisma";

export function slugifyDisplayName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** e.g. "Mira Chen" → "mira-c", "Andrew Smith" → "andrew-s" */
export function coachPublicSlugBase(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "coach";
  const first = slugifyDisplayName(parts[0]!);
  if (parts.length === 1) return first || "coach";
  const lastInitial = (parts[parts.length - 1]![0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!lastInitial) return first || "coach";
  return `${first}-${lastInitial}`;
}

/** Unique slug for coach profiles at /coach/{slug} */
export function coachProfileSlug(displayName: string, _id: string): string {
  return coachPublicSlugBase(displayName);
}

export async function ensureUniqueCoachSlug(displayName: string, coachId: string): Promise<string> {
  const base = coachPublicSlugBase(displayName);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.coachProfile.findFirst({
      where: { slug: candidate, NOT: { id: coachId } },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function coachPublicProfilePath(slug: string | null | undefined): string {
  if (!slug) return "/coaching";
  return `/coach/${encodeURIComponent(slug)}`;
}
