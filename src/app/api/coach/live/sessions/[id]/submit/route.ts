import { NextResponse } from "next/server";
import { updateLiveSession, toLiveSessionView } from "@/lib/live-session-db";
import { getCoachOwnedSession, requireCoachLiveAuth } from "@/lib/coach-live-auth";
import { liveSessionRouteId } from "@/lib/live-sessions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoachLiveAuth(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await getCoachOwnedSession(id, auth.coachProfileId, auth.isAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: "Only drafts or scheduled webinars can be submitted for approval" },
      { status: 409 },
    );
  }

  const row = await updateLiveSession(existing.id, {
    status: "PENDING_APPROVAL",
    submittedForApprovalAt: new Date(),
    rejectionReason: null,
  });

  return NextResponse.json({
    session: { ...toLiveSessionView(row), publicPath: `/live/${liveSessionRouteId(row)}` },
    message: "Submitted for admin approval. You'll be notified when it's published.",
  });
}
