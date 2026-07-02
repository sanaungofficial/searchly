import { isAdminRosterClientRole } from "@/lib/admin-client-roles";
import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";

export type UserSearchResult = {
  id: string;
  email: string;
  name: string | null;
};

export type UserSearchContext = "member" | "client";

export type SearchKimchiUsersOptions = {
  query: string;
  limit?: number;
  orgId?: string;
  context?: UserSearchContext;
};

const DEFAULT_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

function buildSearchWhere(
  query: string,
  options: Pick<SearchKimchiUsersOptions, "orgId" | "context">,
): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [
    {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
  ];

  if (options.context === "client") {
    filters.push({ role: { in: ["USER", "ADMIN"] satisfies UserRole[] } });
  }

  return { AND: filters };
}

async function loadExcludedUserIds(orgId: string, context: UserSearchContext): Promise<string[]> {
  if (context === "member") {
    const members = await prisma.orgMember.findMany({
      where: { orgId },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  const assignments = await prisma.clientAssignment.findMany({
    where: { orgId, assignerType: "COMPANY" },
    select: { clientId: true },
  });
  return assignments.map((assignment) => assignment.clientId);
}

export async function searchKimchiUsers({
  query,
  limit = DEFAULT_LIMIT,
  orgId,
  context,
}: SearchKimchiUsersOptions): Promise<UserSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const cappedLimit = Math.min(Math.max(limit, 1), DEFAULT_LIMIT);
  const where = buildSearchWhere(trimmed, { orgId, context });

  let excludedUserIds: string[] = [];
  if (orgId && context) {
    excludedUserIds = await loadExcludedUserIds(orgId, context);
  }

  const users = await prisma.user.findMany({
    where:
      excludedUserIds.length > 0
        ? { AND: [where, { id: { notIn: excludedUserIds } }] }
        : where,
    select: { id: true, email: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: cappedLimit,
  });

  return users
    .filter((user) => (context === "client" ? isAdminRosterClientRole(user.role) : true))
    .map(({ id, email, name }) => ({ id, email, name }));
}
