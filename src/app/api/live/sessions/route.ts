import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { hmsConfigured } from "@/lib/hms";
import { canHostLiveSession } from "@/lib/live-host";
import {
  getUserRegistrationMap,
  listPublicLiveSessions,
  toLiveSessionView,
} from "@/lib/live-session-db";

export async function GET(request: Request) {
  const { authUser, dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const operator = realDbUser ?? dbUser;
  const rows = await listPublicLiveSessions();
  const sessionIds = rows.map((r) => r.id);
  const registeredMap = await getUserRegistrationMap(dbUser.id, sessionIds);

  const sessions = await Promise.all(
    rows.map(async (row) => {
      const view = toLiveSessionView(row, {
        isRegistered: registeredMap.has(row.id),
      });
      const canHost = await canHostLiveSession({
        operator,
        authEmail: authUser.email,
        session: view,
        isImpersonating,
      });
      return { ...view, canHost };
    })
  );

  return NextResponse.json({
    sessions,
    hmsConfigured: hmsConfigured(),
    hasLiveNow: sessions.some((s) => s.isLive),
  });
}
