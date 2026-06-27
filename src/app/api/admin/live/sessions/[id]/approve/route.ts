import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findLiveSessionByRouteId, updateLiveSession, toLiveSessionView } from "@/lib/live-session-db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await findLiveSessionByRouteId(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status !== "PENDING_APPROVAL" && existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Session is not awaiting approval" }, { status: 409 });
  }

  const row = await updateLiveSession(existing.id, {
    status: "SCHEDULED",
    approvedAt: new Date(),
    rejectionReason: null,
  });

  return NextResponse.json({ session: toLiveSessionView(row) });
}
