import type { User } from "@prisma/client";
import type { LiveSession } from "@/lib/live-sessions";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hmsGuestRole, hmsHostRole } from "@/lib/hms";

export type LiveJoinIntent = "host" | "guest";

export async function canHostLiveSession(args: {
  operator: User;
  authEmail: string;
  session: LiveSession;
  isImpersonating: boolean;
}): Promise<boolean> {
  const { operator, authEmail, session, isImpersonating } = args;
  if (isImpersonating) return false;

  if (operator.role === "ADMIN" || isSuperAdmin(authEmail)) return true;
  if (operator.role === "COACH" || operator.role === "RECRUITER") return true;

  const coach = await prisma.coachProfile.findFirst({
    where: {
      OR: [{ userId: operator.id }, ...(authEmail ? [{ email: authEmail }] : [])],
    },
    select: { displayName: true },
  });
  if (coach && coach.displayName.trim().toLowerCase() === session.host.trim().toLowerCase()) {
    return true;
  }

  return false;
}

export async function resolveLiveJoinRole(args: {
  operator: User;
  authEmail: string;
  session: LiveSession;
  isImpersonating: boolean;
  requestedIntent?: LiveJoinIntent;
}): Promise<{ role: string; isHost: boolean }> {
  const canHost = await canHostLiveSession(args);

  if (args.requestedIntent === "guest") {
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

  return { role: hmsGuestRole(), isHost: false };
}

export class LiveHostForbiddenError extends Error {
  constructor() {
    super("You do not have host access for this session");
    this.name = "LiveHostForbiddenError";
  }
}
