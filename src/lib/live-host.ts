import type { User } from "@prisma/client";
import type { LiveSessionView } from "@/lib/live-session-types";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hmsGuestRole, hmsHostRole, hmsViewerRole } from "@/lib/hms";

export type LiveJoinIntent = "host" | "guest";

/**
 * Host access: admin, primary coach, or listed co-host (by coach profile or email).
 */
export async function canHostLiveSession(args: {
  operator: User;
  authEmail: string;
  session: Pick<LiveSessionView, "id" | "coachProfileId" | "host">;
  isImpersonating: boolean;
}): Promise<boolean> {
  const { operator, authEmail, session, isImpersonating } = args;
  if (isImpersonating) return false;

  if (operator.role === "ADMIN" || isSuperAdmin(authEmail)) return true;

  const coach = await prisma.coachProfile.findFirst({
    where: {
      OR: [{ userId: operator.id }, ...(authEmail ? [{ email: authEmail }] : [])],
    },
    select: { id: true, displayName: true },
  });

  if (!coach) {
    const coHostByEmail = authEmail
      ? await prisma.liveSessionCoHost.findFirst({
          where: { liveSessionId: session.id, email: authEmail.toLowerCase() },
        })
      : null;
    return Boolean(coHostByEmail);
  }

  if (session.coachProfileId && coach.id === session.coachProfileId) return true;

  const coHost = await prisma.liveSessionCoHost.findFirst({
    where: {
      liveSessionId: session.id,
      OR: [{ coachProfileId: coach.id }, ...(authEmail ? [{ email: authEmail.toLowerCase() }] : [])],
    },
  });
  if (coHost) return true;

  if (!session.coachProfileId) {
    return coach.displayName.trim().toLowerCase() === session.host.trim().toLowerCase();
  }

  return false;
}

export async function resolveLiveJoinRole(args: {
  operator: User;
  authEmail: string;
  session: Pick<LiveSessionView, "id" | "coachProfileId" | "host" | "format">;
  isImpersonating: boolean;
  requestedIntent?: LiveJoinIntent;
}): Promise<{ role: string; isHost: boolean }> {
  const canHost = await canHostLiveSession(args);

  if (args.requestedIntent === "guest") {
    if (args.session.format === "BROADCAST") {
      return { role: hmsViewerRole(), isHost: false };
    }
    return { role: hmsGuestRole(), isHost: false };
  }

  if (args.requestedIntent === "host") {
    if (!canHost) {
      throw new LiveHostForbiddenError();
    }
    return { role: hmsHostRole(), isHost: true };
  }

  if (canHost) {
    return { role: hmsHostRole(), isHost: true };
  }

  if (args.session.format === "BROADCAST") {
    return { role: hmsViewerRole(), isHost: false };
  }

  return { role: hmsGuestRole(), isHost: false };
}

export class LiveHostForbiddenError extends Error {
  constructor() {
    super("You do not have host access for this session");
    this.name = "LiveHostForbiddenError";
  }
}
