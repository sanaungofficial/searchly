import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import {
  ensureLiveRoom,
  getHmsSdk,
  hmsConfigured,
  hmsGuestRole,
  hmsHostRole,
  prepareLiveRoom,
} from "@/lib/hms";
import {
  canHostLiveSession,
  LiveHostForbiddenError,
  resolveLiveJoinRole,
  type LiveJoinIntent,
} from "@/lib/live-host";
import {
  findLiveSessionByRouteId,
  markLiveSessionJoined,
  toLiveSessionView,
} from "@/lib/live-session-db";

export async function POST(request: Request) {
  if (!hmsConfigured()) {
    return NextResponse.json(
      { error: "Live video is not configured. Set HMS_ACCESS_KEY and HMS_SECRET." },
      { status: 503 }
    );
  }

  const { authUser, dbUser, realDbUser, isImpersonating } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; intent?: LiveJoinIntent };
  try {
    body = (await request.json()) as { sessionId?: string; intent?: LiveJoinIntent };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const row = await findLiveSessionByRouteId(sessionId);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (row.status === "CANCELLED" || row.status === "ENDED") {
    return NextResponse.json({ error: "This session has ended" }, { status: 410 });
  }

  const session = toLiveSessionView(row);
  const operator = realDbUser ?? dbUser;
  const intent = body.intent === "host" || body.intent === "guest" ? body.intent : undefined;

  let role: string;
  let isHost: boolean;
  try {
    ({ role, isHost } = await resolveLiveJoinRole({
      operator,
      authEmail: authUser.email,
      session,
      isImpersonating,
      requestedIntent: intent,
    }));
  } catch (err) {
    if (err instanceof LiveHostForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  if (!isHost && row.status !== "LIVE") {
    return NextResponse.json(
      {
        error: "This session has not started yet. Register and return when we're live.",
        code: "NOT_LIVE",
      },
      { status: 403 }
    );
  }

  const canHost = await canHostLiveSession({
    operator,
    authEmail: authUser.email,
    session,
    isImpersonating,
  });

  const userId = dbUser.id;
  const userName =
    dbUser.name?.trim() ||
    authUser.email?.split("@")[0] ||
    "Guest";

  try {
    const roomId =
      row.status === "LIVE" || isHost
        ? await prepareLiveRoom(row)
        : await ensureLiveRoom(row);
    const hms = getHmsSdk();
    const auth = await hms.auth.getAuthToken({
      roomId,
      role,
      userId,
      validForSeconds: 60 * 60 * 4,
    });
    const authToken = typeof auth === "string" ? auth : auth.token;

    await markLiveSessionJoined(row.id, dbUser.id);

    return NextResponse.json({
      authToken,
      roomId,
      role,
      isHost,
      canHost,
      userName,
      session: {
        id: session.id,
        title: session.title,
        host: session.host,
        isLive: session.isLive,
      },
    });
  } catch (err) {
    console.error("[live/join]", err);
    return NextResponse.json(
      {
        error: "Could not start live room. Check 100ms template roles (host/guest).",
        expectedRoles: { host: hmsHostRole(), guest: hmsGuestRole() },
      },
      { status: 502 }
    );
  }
}
