import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findLiveSessionByRouteId } from "@/lib/live-session-db";
import { getSessionAnalytics, getPlatformLiveAnalytics } from "@/lib/live-session-events";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const sp = new URL(request.url).searchParams;

  if (id === "platform") {
    const days = Number.parseInt(sp.get("days") ?? "30", 10);
    const analytics = await getPlatformLiveAnalytics(Number.isFinite(days) ? days : 30);
    return NextResponse.json(analytics);
  }

  const row = await findLiveSessionByRouteId(id);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const analytics = await getSessionAnalytics(row.id);
  return NextResponse.json(analytics);
}
