import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { findLiveSessionByRouteId, registerForLiveSession } from "@/lib/live-session-db";

export async function POST(request: Request) {
  const { authUser, dbUser } = await getActingUser(request);
  if (!authUser || !dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
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
    return NextResponse.json({ error: "This session is no longer available" }, { status: 410 });
  }

  await registerForLiveSession(row.id, dbUser.id);

  return NextResponse.json({ ok: true, registered: true });
}
