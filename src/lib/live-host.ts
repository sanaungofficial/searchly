import type { User } from "@prisma/client";
import type { LiveSessionView } from "@/lib/live-session-types";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hmsGuestRole, hmsHostRole } from "@/lib/hms";

export type LiveJoinIntent = "host" | "guest";

/**
 * Host access policy:
 * - Admins / super admins → any session
 * - Assigned coach (session.coachProfileId) → their session only
 * - Legacy fallback: coach displayName matches session.host when no coachProfileId set
 * - Everyone else → guest only (including coaches on other hosts' sessions)
 */
export async function canHostLiveSession(args: {
  operator: User;
  authEmail: string;
  session: Pick<LiveSessionView, "coachProfileId" | "host">;
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

  if (!coach) return false;

  if (session.coachProfileId) {
    return coach.id === session.coachProfileId;
  }

  // Legacy sessions created before coachProfileId was set
  return coach.displayName.trim().toLowerCase() === session.host.trim().toLowerCase();
}

export async function resolveLiveJoinRole(args: {
  operator: User;
  authEmail: string;
  session: Pick<LiveSessionView, "coachProfileId" | "host">;
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

  // Default: assigned hosts join as host; everyone else as guest
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
