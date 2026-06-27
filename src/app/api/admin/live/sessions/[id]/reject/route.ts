import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findLiveSessionByRouteId, updateLiveSession, toLiveSessionView } from "@/lib/live-session-db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await findLiveSessionByRouteId(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* optional body */
  }

  const row = await updateLiveSession(existing.id, {
    status: "DRAFT",
    rejectionReason: body.reason?.trim() || "Changes needed before publishing.",
    submittedForApprovalAt: null,
    approvedAt: null,
  });

  return NextResponse.json({ session: toLiveSessionView(row) });
}
