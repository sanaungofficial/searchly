import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { getCoachProfileForUser } from "@/lib/coach-hub";
import {
  createCoachClientSessionNote,
  listCoachClientSessionNotes,
} from "@/lib/coach-client-session-notes";
import { canCoachShareWithClient } from "@/lib/coach-shared-documents";
import { prisma } from "@/lib/prisma";

async function getCoachActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const me = await prisma.user.findUnique({ where: { email: user.email } });
  if (!me || me.role !== UserRole.COACH) return null;
  const coachProfile = await getCoachProfileForUser(me.id, me.role);
  if (!coachProfile) return null;
  return { me, coachProfile };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  if (!(await canCoachShareWithClient(actor.coachProfile.id, clientUserId))) {
    return NextResponse.json({ error: "No coaching relationship with this client" }, { status: 403 });
  }

  const notes = await listCoachClientSessionNotes({
    clientUserId,
    coachProfileId: actor.coachProfile.id,
  });
  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  let body: { sessionNotes?: string; homework?: string; coachBookingId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const note = await createCoachClientSessionNote({
      coachProfileId: actor.coachProfile.id,
      clientUserId,
      createdByUserId: actor.me.id,
      coachBookingId: body.coachBookingId ?? null,
      sessionNotes: body.sessionNotes,
      homework: body.homework,
    });
    return NextResponse.json({ note });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save";
    const status = message === "FORBIDDEN" ? 403 : message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
