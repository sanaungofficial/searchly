import { NextResponse } from "next/server";
import { findLiveSessionByRouteId } from "@/lib/live-session-db";
import { buildLiveSessionIcs } from "@/lib/live-calendar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await findLiveSessionByRouteId(id);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const ics = buildLiveSessionIcs({
    title: row.title,
    description: row.description,
    host: row.hostName,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    legacyNumericId: row.legacyNumericId,
    id: row.id,
  });

  const filename = `kimchi-live-${row.legacyNumericId ?? row.id.slice(0, 8)}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
