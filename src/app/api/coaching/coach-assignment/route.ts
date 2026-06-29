import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  assignCoachToClient,
  getAssignedCoachesForUser,
  removeCoachAssignment,
} from "@/lib/coach-client-assignment";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";

function canAssignRestrictedCoach(acting: Awaited<ReturnType<typeof getActingUser>>): boolean {
  if (acting.realDbUser?.role !== UserRole.ADMIN) return false;
  if (acting.isImpersonating || acting.isAdminReviewing) return true;
  return acting.dbUser?.role === UserRole.ADMIN;
}

export async function GET(request: NextRequest) {
  const { dbUser: me } = await getActingUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({
    coaches,
    coachIds: coaches.map((c) => c.coachProfileId),
  });
}

export async function POST(req: NextRequest) {
  const acting = await getActingUser(req);
  const me = acting.dbUser;
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== UserRole.USER && me.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Only client accounts can save coaches here." }, { status: 403 });
  }

  const adminAssigning = canAssignRestrictedCoach(acting);

  const body = await req.json().catch(() => ({}));
  const coachProfileId = String(body.coachProfileId ?? "").trim();
  if (!coachProfileId) {
    return NextResponse.json({ error: "coachProfileId required" }, { status: 400 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, displayName: true, isInternal: true, requiresAssignment: true, status: true },
  });
  if (!coach || coach.status !== "ACTIVE") {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  await assignCoachToClient({
    userId: me.id,
    coachProfileId,
    assignedByUserId: adminAssigning && acting.realDbUser ? acting.realDbUser.id : me.id,
    notes: adminAssigning ? "Assigned by admin" : "Added from coaching directory",
  });

  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({
    coaches,
    coachIds: coaches.map((c) => c.coachProfileId),
    coach,
  });
}

export async function DELETE(req: NextRequest) {
  const { dbUser: me } = await getActingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== UserRole.USER && me.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Only client accounts can remove coaches here." }, { status: 403 });
  }

  const coachProfileId = req.nextUrl.searchParams.get("coachProfileId")?.trim();
  if (!coachProfileId) {
    return NextResponse.json({ error: "coachProfileId required" }, { status: 400 });
  }

  await removeCoachAssignment(me.id, coachProfileId);
  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({
    coaches,
    coachIds: coaches.map((c) => c.coachProfileId),
  });
}
