import { UserRole } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import { getCoachProfileForUser } from "@/lib/coach-hub";
import { findLiveSessionByRouteId, type LiveSessionRecord } from "@/lib/live-session-db";

export type CoachLiveAuth = {
  userId: string;
  email: string;
  coachProfileId: string;
  coachDisplayName: string;
  isAdmin: boolean;
};

export async function requireCoachLiveAuth(request: Request): Promise<CoachLiveAuth | null> {
  const { authUser, dbUser, realDbUser } = await getActingUser(request);
  const me = realDbUser ?? dbUser;
  if (!authUser || !me) return null;
  if (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN) return null;

  const profile = await getCoachProfileForUser(me.id, me.role);
  if (!profile && me.role === UserRole.COACH) return null;

  return {
    userId: me.id,
    email: authUser.email ?? me.email,
    coachProfileId: profile!.id,
    coachDisplayName: profile!.displayName,
    isAdmin: me.role === UserRole.ADMIN,
  };
}

export async function getCoachOwnedSession(
  routeId: string,
  coachProfileId: string,
  isAdmin: boolean,
): Promise<LiveSessionRecord | null> {
  const row = await findLiveSessionByRouteId(routeId);
  if (!row) return null;
  if (isAdmin) return row;
  if (row.coachProfileId !== coachProfileId) return null;
  return row;
}

export type CoHostInput = {
  coachProfileId?: string | null;
  displayName: string;
  email?: string | null;
};

export function normalizeCoHosts(raw: CoHostInput[] | undefined): CoHostInput[] {
  if (!raw?.length) return [];
  return raw
    .map((h, i) => ({
      coachProfileId: h.coachProfileId?.trim() || null,
      displayName: h.displayName?.trim() ?? "",
      email: h.email?.trim().toLowerCase() || null,
      sortOrder: i,
    }))
    .filter((h) => h.displayName.length > 0);
}
