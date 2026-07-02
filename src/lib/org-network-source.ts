import { prisma } from "@/lib/prisma";
import type {
  NetworkPoolVisibility,
  NetworkSourceStatus,
  OrgNetworkSource,
  UserEmailGrant,
} from "@prisma/client";

export type OrgNetworkSourceView = {
  id: string;
  orgMemberId: string;
  orgId: string;
  userId: string;
  visibility: NetworkPoolVisibility;
  status: NetworkSourceStatus;
  email: string | null;
  provider: string | null;
  nylasGrantId: string | null;
  userEmailGrantId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  member: {
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null };
  };
};

export function parseNetworkPoolVisibility(value: unknown): NetworkPoolVisibility | null {
  if (value === "PRIVATE" || value === "POOLED") return value;
  return null;
}

export function orgNetworkAdminReturnPath(orgId: string) {
  return `/admin/orgs/${encodeURIComponent(orgId)}#employees`;
}

export function orgNetworkMemberReturnPath(orgId: string) {
  return `/org/${encodeURIComponent(orgId)}/settings/network`;
}

export function serializeOrgNetworkSource(
  source: OrgNetworkSource & {
    orgMember: {
      id: string;
      orgId: string;
      userId: string;
      role: string;
      user: { id: string; email: string; name: string | null };
    };
  },
): OrgNetworkSourceView {
  return {
    id: source.id,
    orgMemberId: source.orgMemberId,
    orgId: source.orgMember.orgId,
    userId: source.orgMember.userId,
    visibility: source.visibility,
    status: source.status,
    email: source.email,
    provider: source.provider,
    nylasGrantId: source.nylasGrantId,
    userEmailGrantId: source.userEmailGrantId,
    connectedAt: source.connectedAt?.toISOString() ?? null,
    lastSyncAt: source.lastSyncAt?.toISOString() ?? null,
    member: {
      id: source.orgMember.id,
      role: source.orgMember.role,
      user: source.orgMember.user,
    },
  };
}

const orgNetworkSourceInclude = {
  orgMember: {
    select: {
      id: true,
      orgId: true,
      userId: true,
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
  },
} as const;

export async function getOrgMemberById(orgMemberId: string, orgId: string) {
  return prisma.orgMember.findFirst({
    where: { id: orgMemberId, orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}

export async function getOrgNetworkSourceByMemberId(orgMemberId: string) {
  return prisma.orgNetworkSource.findUnique({
    where: { orgMemberId },
    include: orgNetworkSourceInclude,
  });
}

export async function getOrgNetworkSourceForUserInOrg(orgId: string, userId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { id: true },
  });
  if (!membership) return null;

  return getOrgNetworkSourceByMemberId(membership.id);
}

export async function listOrgNetworkSourcesForOrg(orgId: string) {
  const members = await prisma.orgMember.findMany({
    where: { orgId },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: {
      user: { select: { id: true, email: true, name: true } },
      networkSource: true,
    },
  });

  return members.map((member) => ({
    orgMemberId: member.id,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: member.user,
    source: member.networkSource
      ? {
          id: member.networkSource.id,
          visibility: member.networkSource.visibility,
          status: member.networkSource.status,
          email: member.networkSource.email,
          provider: member.networkSource.provider,
          connectedAt: member.networkSource.connectedAt?.toISOString() ?? null,
          lastSyncAt: member.networkSource.lastSyncAt?.toISOString() ?? null,
        }
      : null,
  }));
}

export async function linkOrgNetworkSourceFromGrant(params: {
  orgMemberId: string;
  grant: Pick<UserEmailGrant, "id" | "nylasGrantId" | "email" | "provider">;
  visibility: NetworkPoolVisibility;
}) {
  const now = new Date();
  return prisma.orgNetworkSource.upsert({
    where: { orgMemberId: params.orgMemberId },
    create: {
      orgMemberId: params.orgMemberId,
      userEmailGrantId: params.grant.id,
      nylasGrantId: params.grant.nylasGrantId,
      email: params.grant.email,
      provider: params.grant.provider,
      visibility: params.visibility,
      status: "ACTIVE",
      connectedAt: now,
    },
    update: {
      userEmailGrantId: params.grant.id,
      nylasGrantId: params.grant.nylasGrantId,
      email: params.grant.email,
      provider: params.grant.provider,
      visibility: params.visibility,
      status: "ACTIVE",
      connectedAt: now,
    },
    include: orgNetworkSourceInclude,
  });
}

export async function completeOrgNetworkOAuth(params: {
  orgMemberId: string;
  userId: string;
  nylasGrantId: string;
  email: string | null;
  provider: string | null;
  visibility: NetworkPoolVisibility;
}) {
  const grant = await prisma.userEmailGrant.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      nylasGrantId: params.nylasGrantId,
      email: params.email,
      provider: params.provider,
      connectedAt: new Date(),
    },
    update: {
      nylasGrantId: params.nylasGrantId,
      email: params.email,
      provider: params.provider,
      connectedAt: new Date(),
    },
  });

  return linkOrgNetworkSourceFromGrant({
    orgMemberId: params.orgMemberId,
    grant,
    visibility: params.visibility,
  });
}

export async function updateOrgNetworkSourceVisibility(
  orgMemberId: string,
  visibility: NetworkPoolVisibility,
) {
  const existing = await prisma.orgNetworkSource.findUnique({ where: { orgMemberId } });
  if (!existing) {
    return prisma.orgNetworkSource.create({
      data: {
        orgMemberId,
        visibility,
        status: "DISCONNECTED",
      },
      include: orgNetworkSourceInclude,
    });
  }

  return prisma.orgNetworkSource.update({
    where: { orgMemberId },
    data: { visibility },
    include: orgNetworkSourceInclude,
  });
}

export async function disconnectOrgNetworkSource(orgMemberId: string) {
  const existing = await prisma.orgNetworkSource.findUnique({ where: { orgMemberId } });
  if (!existing) {
    return prisma.orgNetworkSource.create({
      data: {
        orgMemberId,
        status: "DISCONNECTED",
      },
      include: orgNetworkSourceInclude,
    });
  }

  return prisma.orgNetworkSource.update({
    where: { orgMemberId },
    data: {
      status: "DISCONNECTED",
      nylasGrantId: null,
      userEmailGrantId: null,
      email: null,
      provider: null,
      connectedAt: null,
    },
    include: orgNetworkSourceInclude,
  });
}

export function countPooledContributors(
  rows: Awaited<ReturnType<typeof listOrgNetworkSourcesForOrg>>,
) {
  const total = rows.length;
  const contributing = rows.filter(
    (row) => row.source?.status === "ACTIVE" && row.source.visibility === "POOLED",
  ).length;
  return { total, contributing };
}

/**
 * Step 6/7 hook: on-demand Sumble enrichment for org network matches.
 * Not implemented in Step 3 — no auto-enrich; email comes from Nylas/contact ingest.
 */
export async function enrichOrgNetworkMatchStub(_params: {
  orgId: string;
  personName: string;
  companyName?: string;
  linkedInUrl?: string;
}): Promise<{ ok: false; reason: "not_implemented" }> {
  return { ok: false, reason: "not_implemented" };
}
