import type { OrgIntroTrackingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OrgIntroTrackingRow = {
  id: string;
  orgId: string;
  clientId: string;
  orgContactId: string;
  requestedByUserId: string;
  status: OrgIntroTrackingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function serialize(row: {
  id: string;
  orgId: string;
  clientId: string;
  orgContactId: string;
  requestedByUserId: string;
  status: OrgIntroTrackingStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OrgIntroTrackingRow {
  return {
    id: row.id,
    orgId: row.orgId,
    clientId: row.clientId,
    orgContactId: row.orgContactId,
    requestedByUserId: row.requestedByUserId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listOrgIntroTrackingForClient(orgId: string, clientId: string) {
  const rows = await prisma.orgIntroTracking.findMany({
    where: { orgId, clientId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(serialize);
}

export async function listOrgIntroTrackingByContactIds(
  orgId: string,
  clientId: string,
  contactIds: string[],
) {
  if (contactIds.length === 0) return new Map<string, OrgIntroTrackingRow>();
  const rows = await prisma.orgIntroTracking.findMany({
    where: { orgId, clientId, orgContactId: { in: contactIds } },
  });
  return new Map(rows.map((row) => [row.orgContactId, serialize(row)]));
}

export async function upsertOrgIntroTracking(params: {
  orgId: string;
  clientId: string;
  orgContactId: string;
  requestedByUserId: string;
  status: OrgIntroTrackingStatus;
  notes?: string | null;
}) {
  const row = await prisma.orgIntroTracking.upsert({
    where: {
      orgId_clientId_orgContactId: {
        orgId: params.orgId,
        clientId: params.clientId,
        orgContactId: params.orgContactId,
      },
    },
    create: {
      orgId: params.orgId,
      clientId: params.clientId,
      orgContactId: params.orgContactId,
      requestedByUserId: params.requestedByUserId,
      status: params.status,
      notes: params.notes ?? null,
    },
    update: {
      status: params.status,
      notes: params.notes ?? undefined,
    },
  });
  return serialize(row);
}

export async function patchOrgIntroTracking(params: {
  orgId: string;
  id: string;
  status?: OrgIntroTrackingStatus;
  notes?: string | null;
}) {
  const existing = await prisma.orgIntroTracking.findFirst({
    where: { id: params.id, orgId: params.orgId },
  });
  if (!existing) return null;

  const row = await prisma.orgIntroTracking.update({
    where: { id: params.id },
    data: {
      status: params.status,
      notes: params.notes,
    },
  });
  return serialize(row);
}

export async function countPendingIntrosForOrg(orgId: string) {
  return prisma.orgIntroTracking.count({
    where: {
      orgId,
      status: { in: ["REQUESTED", "SENT"] },
    },
  });
}

export async function countPendingIntrosByClient(orgId: string, clientIds: string[]) {
  if (clientIds.length === 0) return new Map<string, number>();
  const rows = await prisma.orgIntroTracking.groupBy({
    by: ["clientId"],
    where: {
      orgId,
      clientId: { in: clientIds },
      status: { in: ["REQUESTED", "SENT"] },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.clientId, row._count._all]));
}
