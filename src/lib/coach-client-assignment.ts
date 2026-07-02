import {
  assignCoachToClient as assignCoachToClientCore,
  getAssignedClientCountForCoach,
  getAssignedClientsForCoach,
  getAssignedCoachIds as getAssignedCoachIdsCore,
  getAssignedCoachesForUser as getAssignedCoachesForUserCore,
  isCoachAssignedToUser as isCoachAssignedToUserCore,
  removeCoachAssignment as removeCoachAssignmentCore,
  type AssignedClientSummary,
  type AssignedCoachSummary,
} from "@/lib/client-assignment";

export type { AssignedClientSummary, AssignedCoachSummary };

export async function getAssignedCoachIds(userId: string): Promise<string[]> {
  return getAssignedCoachIdsCore(userId);
}

export async function isCoachAssignedToUser(coachProfileId: string, userId: string): Promise<boolean> {
  return isCoachAssignedToUserCore(coachProfileId, userId);
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
  // Second Ladder coaches are browsable in the directory for signed-in clients; assignment is separate.
  return true;
}

export async function getAssignedCoachesForUser(userId: string): Promise<AssignedCoachSummary[]> {
  return getAssignedCoachesForUserCore(userId);
}

/** Thin wrapper — dual-writes via client-assignment.ts during migration. */
export async function assignCoachToClient(params: {
  userId: string;
  coachProfileId: string;
  assignedByUserId?: string;
  notes?: string;
}) {
  const row = await assignCoachToClientCore({
    clientId: params.userId,
    coachProfileId: params.coachProfileId,
    assignedByUserId: params.assignedByUserId,
    notes: params.notes,
  });

  return {
    ...row,
    userId: row.clientId,
    user: row.client,
  };
}

export async function removeCoachAssignment(userId: string, coachProfileId: string) {
  return removeCoachAssignmentCore(userId, coachProfileId);
}

export { getAssignedClientCountForCoach, getAssignedClientsForCoach };
