import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLiveRoomStatus, hmsConfigured } from "@/lib/hms";
import {
  disableLiveRoomOnly,
  enableLiveRoomOnly,
  endLiveSession,
  goLiveSession,
} from "@/lib/live-session-actions";
import {
  findLiveSessionByRouteId,
  getAdminLiveOverview,
  listAdminLiveSessions,
  listSessionRegistrations,
  toLiveSessionView,
} from "@/lib/live-session-db";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const detailId = sp.get("sessionId");

  if (detailId) {
    const row = await findLiveSessionByRouteId(detailId);
    if (!row) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const room = hmsConfigured() ? await getLiveRoomStatus(row) : null;
    const registrations = await listSessionRegistrations(row.id);
    return NextResponse.json({
      session: toLiveSessionView(row, {
        activePeerCount: room?.activePeerCount,
        roomEnabled: room?.roomEnabled,
      }),
      room,
      registrations: registrations.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.user.name,
        email: r.user.email,
        registeredAt: r.createdAt.toISOString(),
        joinedAt: r.joinedAt?.toISOString() ?? null,
      })),
    });
  }

  const configured = hmsConfigured();
  const [overview, rows] = await Promise.all([getAdminLiveOverview(), listAdminLiveSessions()]);

  let activeAttendees = 0;
  const sessions = await Promise.all(
    rows.map(async (row) => {
      const room = configured ? await getLiveRoomStatus(row) : null;
      if (row.status === "LIVE" && room?.activePeerCount) {
        activeAttendees += room.activePeerCount;
      }
      return {
        ...toLiveSessionView(row, {
          activePeerCount: room?.activePeerCount,
          roomEnabled: room?.roomEnabled,
        }),
        room,
        activePeers: room?.peers ?? [],
      };
    })
  );

  return NextResponse.json({
    hmsConfigured: configured,
    overview: { ...overview, activeAttendees },
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

  let body: { sessionId?: string; action?: "go-live" | "end" | "enable-room" | "disable-room" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const action = body.action;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const row = await findLiveSessionByRouteId(sessionId);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "go-live": {
        const result = await goLiveSession(row);
        return NextResponse.json({
          ok: true,
          roomId: result.roomId,
          room: result.room,
          isLive: true,
        });
      }
      case "end": {
        const result = await endLiveSession(row, true);
        return NextResponse.json({ ok: true, room: result.room, isLive: false });
      }
      case "enable-room": {
        const result = await enableLiveRoomOnly(row);
        return NextResponse.json({ ok: true, roomId: result.roomId, room: result.room });
      }
      case "disable-room": {
        const result = await disableLiveRoomOnly(row);
        return NextResponse.json({ ok: true, room: result.room });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin/live]", err);
    return NextResponse.json({ error: "Live admin action failed" }, { status: 502 });
  }
}
