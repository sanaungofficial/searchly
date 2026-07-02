import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isClientAssignedToOrg } from "@/lib/client-assignment";
import type { Org, OrgMember, OrgMemberRole, User } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";

export type OrgMembershipWithOrg = OrgMember & { org: Org };

export async function getAuthenticatedDbUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  return prisma.user.findUnique({ where: { email: user.email } });
}

export async function requireOrgMember(
  orgId: string,
  options?: { adminOnly?: boolean },
): Promise<OrgMembershipWithOrg | null> {
  const dbUser = await getAuthenticatedDbUser();
  if (!dbUser) return null;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: dbUser.id } },
    include: { org: true },
  });
  if (!membership) return null;
  if (options?.adminOnly && membership.role !== "ADMIN") return null;
  return membership;
}

/** Platform admin or org member (any role). */
export async function requireOrgMemberOrPlatformAdmin(
  orgId: string,
  options?: { adminOnly?: boolean },
): Promise<{ user: User; membership: OrgMembershipWithOrg | null } | null> {
  const admin = await requireAdmin();
  if (admin) return { user: admin, membership: null };

  const membership = await requireOrgMember(orgId, options);
  if (!membership) return null;

  const dbUser = await getAuthenticatedDbUser();
  if (!dbUser) return null;
  return { user: dbUser, membership };
}

export async function canOrgAccessClient(orgId: string, clientId: string): Promise<boolean> {
  const assigned = await isClientAssignedToOrg(orgId, clientId);
  if (!assigned) return false;

  const dbUser = await getAuthenticatedDbUser();
  if (!dbUser) return false;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: dbUser.id } },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function listOrgsForUser(userId: string) {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          website: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ org: { name: "asc" } }],
  });

  return memberships.map((membership) => ({
    id: membership.org.id,
    name: membership.org.name,
    slug: membership.org.slug,
    website: membership.org.website,
    logoUrl: membership.org.logoUrl,
    role: membership.role as OrgMemberRole,
    joinedAt: membership.joinedAt.toISOString(),
    createdAt: membership.org.createdAt.toISOString(),
    updatedAt: membership.org.updatedAt.toISOString(),
  }));
}
