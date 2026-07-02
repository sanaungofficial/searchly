import { prisma } from "@/lib/prisma";
import { isClientAssignedToOrg } from "@/lib/client-assignment";
import { resolveCompanyIntelFromInput } from "@/lib/company-intel";
import { normalizeWebsiteUrl } from "@/lib/hirebase-company-sync";

export async function listEmployeeTargetCompanies(userId: string) {
  return prisma.trackedCompany.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      website: true,
      careersUrl: true,
      createdAt: true,
      companyIntel: { select: { slug: true, website: true, careersUrl: true } },
    },
    take: 50,
  });
}

export async function addEmployeeTargetCompany(
  orgId: string,
  userId: string,
  input: { name: string; website?: string | null },
) {
  const assigned = await isClientAssignedToOrg(orgId, userId);
  if (!assigned) return { ok: false as const, error: "Employee is not assigned to this organization." };

  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Company name is required." };

  const website = input.website?.trim() ? normalizeWebsiteUrl(input.website.trim()) : null;

  const existing = await prisma.trackedCompany.findFirst({
    where: {
      userId,
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        ...(website ? [{ website: { equals: website, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true },
  });
  if (existing) {
    return { ok: false as const, error: "Already on this employee's target list.", existing: existing as { id: string; name: string } };
  }

  let intel = null;
  try {
    intel = await resolveCompanyIntelFromInput({ name, website });
  } catch {
    // Non-blocking — store raw name/website
  }

  const company = await prisma.trackedCompany.create({
    data: {
      userId,
      companyIntelId: intel?.id ?? null,
      name: intel?.name ?? name,
      website: website ?? intel?.website ?? null,
    },
    select: { id: true, name: true, website: true, createdAt: true },
  });

  return { ok: true as const, company };
}

export async function removeEmployeeTargetCompany(orgId: string, userId: string, companyId: string) {
  const assigned = await isClientAssignedToOrg(orgId, userId);
  if (!assigned) return { ok: false as const, error: "Employee is not assigned to this organization." };

  const company = await prisma.trackedCompany.findFirst({
    where: { id: companyId, userId },
    select: { id: true },
  });
  if (!company) return { ok: false as const, error: "Target company not found." };

  await prisma.trackedCompany.delete({ where: { id: companyId } });
  return { ok: true as const };
}
