import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { canHostLiveSession } from "@/lib/live-host";
import { findLiveSessionByRouteId, toLiveSessionView } from "@/lib/live-session-db";
import { removeLivePeer } from "@/lib/hms";
import { logLiveSessionEvent } from "@/lib/live-session-events";

export async function POST(request: Request) {
  const { authUser, dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; action?: "remove-peer"; peerId?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const peerId = body.peerId?.trim();
  if (!sessionId || body.action !== "remove-peer" || !peerId) {
    return NextResponse.json(
      { error: "sessionId, action=remove-peer, peerId required" },
      { status: 400 },
    );
  }

  const row = await findLiveSessionByRouteId(sessionId);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const operator = realDbUser ?? dbUser;
  const session = toLiveSessionView(row);
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
    await removeLivePeer(row, peerId, body.reason ?? "Removed by host");
    await logLiveSessionEvent({
      liveSessionId: row.id,
      userId: dbUser.id,
      type: "PEER_REMOVED",
      metadata: { peerId, reason: body.reason },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[live/moderate]", err);
    return NextResponse.json({ error: "Moderation action failed" }, { status: 502 });
  }
}
