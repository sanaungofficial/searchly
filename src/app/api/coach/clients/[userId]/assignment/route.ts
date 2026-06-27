import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { assignCoachToClient, removeCoachAssignment } from "@/lib/coach-client-assignment";
import { getCoachProfileForUser } from "@/lib/coach-hub";

async function getCoachActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const me = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!me || me.role !== UserRole.COACH) return null;
  const profile = await getCoachProfileForUser(me.id, me.role);
  if (!profile) return null;
  return { me, coachProfileId: profile.id };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const client = await prisma.user.findFirst({
    where: { id: userId, role: UserRole.USER },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await assignCoachToClient({
    userId,
    coachProfileId: actor.coachProfileId,
    assignedByUserId: actor.me.id,
    notes: "Assigned from coach portal",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  await removeCoachAssignment(userId, actor.coachProfileId);
  return NextResponse.json({ ok: true });
}
