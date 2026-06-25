import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { hmsConfigured } from "@/lib/hms";
import { canHostLiveSession } from "@/lib/live-host";
import { endLiveSession, goLiveSession } from "@/lib/live-session-actions";
import { findLiveSessionByRouteId } from "@/lib/live-session-db";

export async function POST(request: Request) {
  if (!hmsConfigured()) {
    return NextResponse.json({ error: "Live video is not configured." }, { status: 503 });
  }

  const { authUser, dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; action?: "go-live" | "end" };
  try {
    body = (await request.json()) as { sessionId?: string; action?: "go-live" | "end" };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const action = body.action;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (action !== "go-live" && action !== "end") {
    return NextResponse.json({ error: "action must be go-live or end" }, { status: 400 });
  }

  const row = await findLiveSessionByRouteId(sessionId);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const operator = realDbUser ?? dbUser;
  const sessionView = { coachProfileId: row.coachProfileId, host: row.hostName };
  const canHost = await canHostLiveSession({
    operator,
    authEmail: authUser.email,
    session: sessionView,
    isImpersonating,
  });

  if (!canHost) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  try {
    if (action === "go-live") {
      const result = await goLiveSession(row);
      return NextResponse.json({ ok: true, isLive: true, roomId: result.roomId });
    }
    const result = await endLiveSession(row, true);
    return NextResponse.json({ ok: true, isLive: false, room: result.room });
  } catch (err) {
    console.error("[live/control]", err);
    return NextResponse.json({ error: "Live room action failed" }, { status: 502 });
  }
}
