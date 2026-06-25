import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { endLiveRoom, hmsConfigured, prepareLiveRoom } from "@/lib/hms";
import { canHostLiveSession, LiveHostForbiddenError } from "@/lib/live-host";
import { getLiveSessionByIdMerged } from "@/lib/live-sessions";
import { markSessionEnded, markSessionLiveNow } from "@/lib/live-session-state";

export async function POST(request: Request) {
  if (!hmsConfigured()) {
    return NextResponse.json({ error: "Live video is not configured." }, { status: 503 });
  }

  const { authUser, dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: number; action?: "go-live" | "end" };
  try {
    body = (await request.json()) as { sessionId?: number; action?: "go-live" | "end" };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  const action = body.action;
  if (sessionId == null || !Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (action !== "go-live" && action !== "end") {
    return NextResponse.json({ error: "action must be go-live or end" }, { status: 400 });
  }

  const session = await getLiveSessionByIdMerged(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const operator = realDbUser ?? dbUser;
  const canHost = await canHostLiveSession({
    operator,
    authEmail: authUser.email,
    session,
    isImpersonating,
  });

  if (!canHost) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  try {
    if (action === "go-live") {
      const roomId = await prepareLiveRoom(sessionId);
      await markSessionLiveNow(sessionId, authUser.email);
      return NextResponse.json({ ok: true, roomId, isLive: true });
    }

    await endLiveRoom(sessionId, true);
    await markSessionEnded(sessionId, authUser.email);
    return NextResponse.json({ ok: true, isLive: false });
  } catch (err) {
    console.error("[live/control]", err);
    return NextResponse.json({ error: "Live room action failed" }, { status: 502 });
  }
}
