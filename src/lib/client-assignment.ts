import { AssignmentAssignerType, CoachStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AssignedCoachSummary = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  isInternal: boolean;
  hasNylasBooking: boolean;
  assignedAt: string;
  notes: string | null;
};

export type AssignedClientSummary = {
  assignmentId: string;
  userId: string;
  email: string;
  name: string | null;
  assignedAt: string;
  notes: string | null;
};

export type OrgAssignmentSummary = {
  assignmentId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  assignedAt: string;
  notes: string | null;
};

const coachProfileSelect = {
  id: true,
  displayName: true,
  slug: true,
  photoUrl: true,
  headline: true,
  isInternal: true,
  nylasSchedulerConfigId: true,
  status: true,
} as const;

async function listCoachAssignmentRows(clientId: string) {
  const rows = await prisma.clientAssignment.findMany({
    where: { clientId, assignerType: AssignmentAssignerType.COACH },
    orderBy: { createdAt: "desc" },
    include: { coachProfile: { select: coachProfileSelect } },
  });
  if (rows.length > 0) return rows;

  const legacy = await prisma.coachClientAssignment.findMany({
    where: { userId: clientId },
    orderBy: { createdAt: "desc" },
    include: { coachProfile: { select: coachProfileSelect } },
  });
  return legacy.map((row) => ({
    id: row.id,
    notes: row.notes,
    createdAt: row.createdAt,
    coachProfile: row.coachProfile,
    coachProfileId: row.coachProfileId,
  }));
}

async function listCoachAssignmentRowsForCoach(coachProfileId: string) {
  const rows = await prisma.clientAssignment.findMany({
    where: { coachProfileId, assignerType: AssignmentAssignerType.COACH },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, email: true, name: true } } },
  });
  if (rows.length > 0) return rows;

  const legacy = await prisma.coachClientAssignment.findMany({
    where: { coachProfileId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return legacy.map((row) => ({
    id: row.id,
    notes: row.notes,
    createdAt: row.createdAt,
    client: row.user,
    clientId: row.userId,
  }));
}

export async function getAssignedCoachIds(clientId: string): Promise<string[]> {
  const rows = await listCoachAssignmentRows(clientId);
  return rows.map((r) => r.coachProfileId);
}

export async function isCoachAssignedToUser(coachProfileId: string, clientId: string): Promise<boolean> {
  const polymorphic = await prisma.clientAssignment.findFirst({
    where: {
      clientId,
      assignerType: AssignmentAssignerType.COACH,
      coachProfileId,
    },
    select: { id: true },
  });
  if (polymorphic) return true;

  const legacy = await prisma.coachClientAssignment.findUnique({
    where: { userId_coachProfileId: { userId: clientId, coachProfileId } },
    select: { id: true },
  });
  return Boolean(legacy);
}

export async function getAssignedCoachesForUser(clientId: string): Promise<AssignedCoachSummary[]> {
  const rows = await listCoachAssignmentRows(clientId);

  return rows
    .filter((r) => r.coachProfile?.status === CoachStatus.ACTIVE)
    .map((r) => ({
      coachProfileId: r.coachProfile!.id,
      displayName: r.coachProfile!.displayName,
      slug: r.coachProfile!.slug,
      photoUrl: r.coachProfile!.photoUrl,
      headline: r.coachProfile!.headline,
      isInternal: r.coachProfile!.isInternal,
      hasNylasBooking: Boolean(r.coachProfile!.nylasSchedulerConfigId),
      assignedAt: r.createdAt.toISOString(),
      notes: r.notes,
    }));
}

/**
 * Dual-write transition: upserts ClientAssignment (canonical) and CoachClientAssignment (legacy readers).
 */
export async function assignCoachToClient(params: {
  clientId: string;
  coachProfileId: string;
  assignedByUserId?: string;
  notes?: string;
}) {
  const { clientId, coachProfileId, assignedByUserId, notes } = params;

  return prisma.$transaction(async (tx) => {
    const polymorphic = await tx.clientAssignment.upsert({
      where: {
        clientId_assignerType_coachProfileId: {
          clientId,
          assignerType: AssignmentAssignerType.COACH,
          coachProfileId,
        },
      },
      create: {
        assignerType: AssignmentAssignerType.COACH,
        clientId,
        coachProfileId,
        assignedByUserId: assignedByUserId ?? null,
        notes: notes ?? null,
      },
      update: {
        assignedByUserId: assignedByUserId ?? undefined,
        notes: notes ?? undefined,
      },
      include: {
        coachProfile: { select: { displayName: true, slug: true } },
        client: { select: { email: true, name: true } },
      },
    });

    await tx.coachClientAssignment.upsert({
      where: { userId_coachProfileId: { userId: clientId, coachProfileId } },
      create: {
        userId: clientId,
        coachProfileId,
        assignedByUserId: assignedByUserId ?? null,
        notes: notes ?? null,
      },
      update: {
        assignedByUserId: assignedByUserId ?? undefined,
        notes: notes ?? undefined,
      },
    });

    return polymorphic;
  });
}

/** Dual-write: removes from both tables during transition. */
export async function removeCoachAssignment(clientId: string, coachProfileId: string) {
  await prisma.$transaction([
    prisma.clientAssignment.deleteMany({
      where: {
        clientId,
        assignerType: AssignmentAssignerType.COACH,
        coachProfileId,
      },
    }),
    prisma.coachClientAssignment.deleteMany({
      where: { userId: clientId, coachProfileId },
    }),
  ]);
}

export async function getAssignedClientCountForCoach(coachProfileId: string): Promise<number> {
  const polymorphicCount = await prisma.clientAssignment.count({
    where: { coachProfileId, assignerType: AssignmentAssignerType.COACH },
  });
  if (polymorphicCount > 0) return polymorphicCount;
  return prisma.coachClientAssignment.count({ where: { coachProfileId } });
}

export async function getAssignedClientsForCoach(coachProfileId: string): Promise<AssignedClientSummary[]> {
  const rows = await listCoachAssignmentRowsForCoach(coachProfileId);

  return rows.map((r) => ({
    assignmentId: r.id,
    userId: r.client!.id,
    email: r.client!.email,
    name: r.client!.name,
    assignedAt: r.createdAt.toISOString(),
    notes: r.notes,
  }));
}

export async function getOrgAssignmentsForClient(clientId: string): Promise<OrgAssignmentSummary[]> {
  const rows = await prisma.clientAssignment.findMany({
    where: { clientId, assignerType: AssignmentAssignerType.COMPANY },
    orderBy: { createdAt: "desc" },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });

  return rows.map((row) => ({
    assignmentId: row.id,
    orgId: row.org!.id,
    orgName: row.org!.name,
    orgSlug: row.org!.slug,
    assignedAt: row.createdAt.toISOString(),
    notes: row.notes,
  }));
}

export async function getClientsForOrg(orgId: string): Promise<AssignedClientSummary[]> {
  const rows = await prisma.clientAssignment.findMany({
    where: { orgId, assignerType: AssignmentAssignerType.COMPANY },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, email: true, name: true } } },
  });

  return rows.map((row) => ({
    assignmentId: row.id,
    userId: row.client.id,
    email: row.client.email,
    name: row.client.name,
    assignedAt: row.createdAt.toISOString(),
    notes: row.notes,
  }));
}

export async function isClientAssignedToOrg(orgId: string, clientId: string): Promise<boolean> {
  const row = await prisma.clientAssignment.findFirst({
    where: {
      orgId,
      clientId,
      assignerType: AssignmentAssignerType.COMPANY,
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function assignClientToOrg(params: {
  orgId: string;
  clientId: string;
  assignedByUserId?: string;
  notes?: string;
}) {
  const { orgId, clientId, assignedByUserId, notes } = params;

  return prisma.clientAssignment.upsert({
    where: {
      clientId_assignerType_orgId: {
        clientId,
        assignerType: AssignmentAssignerType.COMPANY,
        orgId,
      },
    },
    create: {
      assignerType: AssignmentAssignerType.COMPANY,
      clientId,
      orgId,
      assignedByUserId: assignedByUserId ?? null,
      notes: notes ?? null,
    },
    update: {
      assignedByUserId: assignedByUserId ?? undefined,
      notes: notes ?? undefined,
    },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function removeClientFromOrg(orgId: string, clientId: string) {
  await prisma.clientAssignment.deleteMany({
    where: {
      orgId,
      clientId,
      assignerType: AssignmentAssignerType.COMPANY,
    },
  });
}
