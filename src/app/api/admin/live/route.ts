import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { endLiveRoom, getLiveRoomStatus, hmsConfigured, prepareLiveRoom } from "@/lib/hms";
import { LIVE_SESSIONS } from "@/lib/live-sessions";
import {
  getLiveSessionRuntimeState,
  markSessionEnded,
  markSessionLiveNow,
  mergeSessionIsLive,
} from "@/lib/live-session-state";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runtime = await getLiveSessionRuntimeState();
  const configured = hmsConfigured();

  const sessions = await Promise.all(
    LIVE_SESSIONS.map(async (session) => {
      const isLive = mergeSessionIsLive(session, runtime);
      const room = configured ? await getLiveRoomStatus(session.id) : null;
      return {
        id: session.id,
        title: session.title,
        host: session.host,
        category: session.category,
        date: session.date,
        time: session.time,
        staticIsLive: session.isLive,
        isLive,
        room,
      };
    })
  );

  return NextResponse.json({
    hmsConfigured: configured,
    runtime,
    sessions,
    hostRoles: {
      host: process.env.HMS_ROLE_HOST?.trim() || "host",
      guest: process.env.HMS_ROLE_GUEST?.trim() || "guest",
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hmsConfigured()) {
    return NextResponse.json({ error: "Live video is not configured." }, { status: 503 });
  }

  let body: { sessionId?: number; action?: "go-live" | "end" | "enable-room" | "disable-room" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  const action = body.action;
  if (sessionId == null || !Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = LIVE_SESSIONS.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "go-live": {
        const roomId = await prepareLiveRoom(sessionId);
        await markSessionLiveNow(sessionId, admin.email);
        const room = await getLiveRoomStatus(sessionId);
        return NextResponse.json({ ok: true, roomId, room, isLive: true });
      }
      case "end": {
        await endLiveRoom(sessionId, true);
        await markSessionEnded(sessionId, admin.email);
        const room = await getLiveRoomStatus(sessionId);
        return NextResponse.json({ ok: true, room, isLive: false });
      }
      case "enable-room": {
        const roomId = await prepareLiveRoom(sessionId);
        const room = await getLiveRoomStatus(sessionId);
        return NextResponse.json({ ok: true, roomId, room });
      }
      case "disable-room": {
        await endLiveRoom(sessionId, true);
        const room = await getLiveRoomStatus(sessionId);
        return NextResponse.json({ ok: true, room });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin/live]", err);
    return NextResponse.json({ error: "Live admin action failed" }, { status: 502 });
  }
}
