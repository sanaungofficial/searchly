import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { getCoachProfileForUser } from "@/lib/coach-hub";
import {
  deleteCoachClientSessionNote,
  updateCoachClientSessionNote,
} from "@/lib/coach-client-session-notes";
import { prisma } from "@/lib/prisma";

async function getCoachActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const me = await prisma.user.findUnique({ where: { email: user.email } });
  if (!me || me.role !== UserRole.COACH) return null;
  const coachProfile = await getCoachProfileForUser(me.id, me.role);
  if (!coachProfile) return null;
  return { coachProfile };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId, noteId } = await params;
  let body: { sessionNotes?: string; homework?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const note = await updateCoachClientSessionNote({
      noteId,
      coachProfileId: actor.coachProfile.id,
      clientUserId,
      sessionNotes: body.sessionNotes,
      homework: body.homework,
    });
    return NextResponse.json({ note });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update";
    const status = message === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId, noteId } = await params;
  try {
    await deleteCoachClientSessionNote({
      noteId,
      coachProfileId: actor.coachProfile.id,
      clientUserId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete";
    return NextResponse.json({ error: message }, { status: message === "NOT_FOUND" ? 404 : 500 });
  }
}
