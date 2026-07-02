import { prisma } from "@/lib/prisma";
import { parseStrengthFactors } from "@/lib/org-contact-graph/types";
import type { Prisma } from "@prisma/client";

export type ListOrgContactsParams = {
  orgId: string;
  company?: string | null;
  search?: string | null;
  sort?: "activity" | "strength" | null;
  limit?: number;
  offset?: number;
};

const knownByInclude = {
  networkSource: {
    select: {
      id: true,
      email: true,
      orgMember: {
        select: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  },
} as const;

function buildWhere(params: ListOrgContactsParams): Prisma.OrgContactWhereInput {
  const where: Prisma.OrgContactWhereInput = { orgId: params.orgId };

  if (params.company?.trim()) {
    where.company = { contains: params.company.trim(), mode: "insensitive" };
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export function serializeOrgContactRow(
  contact: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    title: string | null;
    linkedinUrl: string | null;
    phone: string | null;
    lastActivityAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    knownBy: Array<{
      id: string;
      networkSourceId: string;
      strengthScore: number;
      firstSeenAt: Date | null;
      lastSeenAt: Date | null;
      networkSource: {
        id: string;
        email: string | null;
        orgMember: { user: { id: string; email: string; name: string | null } };
      };
    }>;
  },
) {
  return {
    id: contact.id,
    email: contact.email,
    name: contact.name,
    company: contact.company,
    title: contact.title,
    linkedinUrl: contact.linkedinUrl,
    phone: contact.phone,
    lastActivityAt: contact.lastActivityAt?.toISOString() ?? null,
    maxStrengthScore: contact.knownBy.reduce((max, edge) => Math.max(max, edge.strengthScore), 0),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    knownBy: contact.knownBy.map((edge) => ({
      id: edge.id,
      networkSourceId: edge.networkSourceId,
      strengthScore: edge.strengthScore,
      firstSeenAt: edge.firstSeenAt?.toISOString() ?? null,
      lastSeenAt: edge.lastSeenAt?.toISOString() ?? null,
      member: {
        id: edge.networkSource.orgMember.user.id,
        email: edge.networkSource.orgMember.user.email,
        name: edge.networkSource.orgMember.user.name,
      },
      sourceEmail: edge.networkSource.email,
    })),
  };
}

export async function listOrgContacts(params: ListOrgContactsParams) {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const where = buildWhere(params);
  const sortByStrength = params.sort === "strength";

  if (sortByStrength) {
    const all = await prisma.orgContact.findMany({
      where,
      include: { knownBy: { include: knownByInclude } },
    });
    all.sort((a, b) => {
      const aMax = a.knownBy.reduce((max, edge) => Math.max(max, edge.strengthScore), 0);
      const bMax = b.knownBy.reduce((max, edge) => Math.max(max, edge.strengthScore), 0);
      if (bMax !== aMax) return bMax - aMax;
      const aAct = a.lastActivityAt?.getTime() ?? 0;
      const bAct = b.lastActivityAt?.getTime() ?? 0;
      return bAct - aAct;
    });
    const total = all.length;
    const contacts = all.slice(offset, offset + limit);
    return { total, limit, offset, contacts: contacts.map(serializeOrgContactRow) };
  }

  const [total, contacts] = await Promise.all([
    prisma.orgContact.count({ where }),
    prisma.orgContact.findMany({
      where,
      orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
      skip: offset,
      include: { knownBy: { include: knownByInclude } },
    }),
  ]);

  return {
    total,
    limit,
    offset,
    contacts: contacts.map(serializeOrgContactRow),
  };
}

export async function getOrgContactDetail(orgId: string, contactId: string) {
  const contact = await prisma.orgContact.findFirst({
    where: { id: contactId, orgId },
    include: {
      knownBy: {
        include: {
          ...knownByInclude,
        },
      },
    },
  });
  if (!contact) return null;

  return {
    ...serializeOrgContactRow(contact),
    activityBySource: contact.knownBy.map((edge) => ({
      networkSourceId: edge.networkSourceId,
      member: {
        id: edge.networkSource.orgMember.user.id,
        email: edge.networkSource.orgMember.user.email,
        name: edge.networkSource.orgMember.user.name,
      },
      sourceEmail: edge.networkSource.email,
      strengthScore: edge.strengthScore,
      firstSeenAt: edge.firstSeenAt?.toISOString() ?? null,
      lastSeenAt: edge.lastSeenAt?.toISOString() ?? null,
      signals: parseStrengthFactors(edge.strengthFactors),
    })),
  };
}
