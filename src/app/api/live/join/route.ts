import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import {
  ensureLiveRoom,
  getHmsSdk,
  hmsConfigured,
  hmsGuestRole,
  hmsHostRole,
} from "@/lib/hms";
import { getLiveSessionById } from "@/lib/live-sessions";

export async function POST(request: Request) {
  if (!hmsConfigured()) {
    return NextResponse.json(
      { error: "Live video is not configured. Set HMS_ACCESS_KEY and HMS_SECRET." },
      { status: 503 }
    );
  }

  const { authUser, dbUser, realDbUser } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: number };
  try {
    body = (await request.json()) as { sessionId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (sessionId == null || !Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = getLiveSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const operator = realDbUser ?? dbUser;
  const isHost =
    operator.role === "ADMIN" ||
    operator.role === "COACH" ||
    operator.role === "RECRUITER";

  const role = isHost ? hmsHostRole() : hmsGuestRole();
  const userId = dbUser.id;
  const userName =
    dbUser.name?.trim() ||
    authUser.email?.split("@")[0] ||
    "Guest";

  try {
    const roomId = await ensureLiveRoom(sessionId);
    const hms = getHmsSdk();
    const auth = await hms.auth.getAuthToken({
      roomId,
      role,
      userId,
      validForSeconds: 60 * 60 * 4,
    });
    const authToken = typeof auth === "string" ? auth : auth.token;

    return NextResponse.json({
      authToken,
      roomId,
      role,
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
      { error: "Could not start live room. Check 100ms template roles (host/guest)." },
      { status: 502 }
    );
  }
}
