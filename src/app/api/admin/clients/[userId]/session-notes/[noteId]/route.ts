import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deleteCoachClientSessionNote,
  updateCoachClientSessionNote,
} from "@/lib/coach-client-session-notes";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId, noteId } = await params;
  let body: { coachProfileId?: string; sessionNotes?: string; homework?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.coachProfileId) {
    return NextResponse.json({ error: "coachProfileId is required" }, { status: 400 });
  }

  try {
    const note = await updateCoachClientSessionNote({
      noteId,
      coachProfileId: body.coachProfileId,
      clientUserId,
      sessionNotes: body.sessionNotes,
      homework: body.homework,
    });
    return NextResponse.json({ note });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update";
    return NextResponse.json({ error: message }, { status: message === "NOT_FOUND" ? 404 : 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId, noteId } = await params;
  const coachProfileId = req.nextUrl.searchParams.get("coachProfileId")?.trim();
  if (!coachProfileId) {
    return NextResponse.json({ error: "coachProfileId is required" }, { status: 400 });
  }

  try {
    await deleteCoachClientSessionNote({ noteId, coachProfileId, clientUserId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete";
    return NextResponse.json({ error: message }, { status: message === "NOT_FOUND" ? 404 : 500 });
  }
}
