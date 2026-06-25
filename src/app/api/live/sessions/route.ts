import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { hmsConfigured } from "@/lib/hms";
import { canHostLiveSession } from "@/lib/live-host";
import { getMergedLiveSessions } from "@/lib/live-session-state";

export async function GET(request: Request) {
  const { authUser, dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const operator = realDbUser ?? dbUser;
  const sessions = await getMergedLiveSessions();

  const enriched = await Promise.all(
    sessions.map(async (session) => {
      const canHost = await canHostLiveSession({
        operator,
        authEmail: authUser.email,
        session,
        isImpersonating,
      });
      return {
        ...session,
        canHost,
      };
    })
  );

  return NextResponse.json({
    sessions: enriched,
    hmsConfigured: hmsConfigured(),
    hasLiveNow: enriched.some((s) => s.isLive),
  });
}
