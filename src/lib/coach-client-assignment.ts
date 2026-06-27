import { CoachStatus } from "@prisma/client";
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

export async function getAssignedCoachIds(userId: string): Promise<string[]> {
  const rows = await prisma.coachClientAssignment.findMany({
    where: { userId },
    select: { coachProfileId: true },
  });
  return rows.map((r) => r.coachProfileId);
}

export async function isCoachAssignedToUser(coachProfileId: string, userId: string): Promise<boolean> {
  const row = await prisma.coachClientAssignment.findUnique({
    where: { userId_coachProfileId: { userId, coachProfileId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function canUserAccessCoach(params: {
  coachProfileId: string;
  userId?: string | null;
  isAdmin?: boolean;
  isInternal: boolean;
}): Promise<boolean> {
  if (!params.isInternal) return true;
  if (params.isAdmin) return true;
  if (!params.userId) return false;
  // Kimchi coaches are browsable in the directory for signed-in clients; assignment is separate.
  return true;
}

export async function getAssignedCoachesForUser(userId: string): Promise<AssignedCoachSummary[]> {
  const rows = await prisma.coachClientAssignment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      coachProfile: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          photoUrl: true,
          headline: true,
          isInternal: true,
          nylasSchedulerConfigId: true,
          status: true,
        },
      },
    },
  });

  return rows
    .filter((r) => r.coachProfile.status === CoachStatus.ACTIVE)
    .map((r) => ({
      coachProfileId: r.coachProfile.id,
      displayName: r.coachProfile.displayName,
      slug: r.coachProfile.slug,
      photoUrl: r.coachProfile.photoUrl,
      headline: r.coachProfile.headline,
      isInternal: r.coachProfile.isInternal,
      hasNylasBooking: Boolean(r.coachProfile.nylasSchedulerConfigId),
      assignedAt: r.createdAt.toISOString(),
      notes: r.notes,
    }));
}

export async function assignCoachToClient(params: {
  userId: string;
  coachProfileId: string;
  assignedByUserId?: string;
  notes?: string;
}) {
  return prisma.coachClientAssignment.upsert({
    where: {
      userId_coachProfileId: { userId: params.userId, coachProfileId: params.coachProfileId },
    },
    create: {
      userId: params.userId,
      coachProfileId: params.coachProfileId,
      assignedByUserId: params.assignedByUserId ?? null,
      notes: params.notes ?? null,
    },
    update: {
      assignedByUserId: params.assignedByUserId ?? undefined,
      notes: params.notes ?? undefined,
    },
    include: {
      coachProfile: { select: { displayName: true, slug: true } },
      user: { select: { email: true, name: true } },
    },
  });
}

export async function removeCoachAssignment(userId: string, coachProfileId: string) {
  await prisma.coachClientAssignment.deleteMany({
    where: { userId, coachProfileId },
  });
}
