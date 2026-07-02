/** URL slug helpers for enterprise orgs. */

import { prisma } from "@/lib/prisma";

export function slugifyOrgName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function ensureUniqueOrgSlug(name: string, orgId: string): Promise<string> {
  const base = slugifyOrgName(name) || "org";
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.org.findFirst({
      where: { slug: candidate, NOT: { id: orgId } },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
