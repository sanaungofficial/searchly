import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  assignCoachToClient,
  getAssignedCoachesForUser,
  removeCoachAssignment,
} from "@/lib/coach-client-assignment";
import { getClientCoachingUser } from "@/lib/coach-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const me = await getClientCoachingUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({
    coaches,
    coachIds: coaches.map((c) => c.coachProfileId),
  });
}

export async function POST(req: NextRequest) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== UserRole.USER) {
    return NextResponse.json({ error: "Only client accounts can save coaches here." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const coachProfileId = String(body.coachProfileId ?? "").trim();
  if (!coachProfileId) {
    return NextResponse.json({ error: "coachProfileId required" }, { status: 400 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, displayName: true, isInternal: true, status: true },
  });
  if (!coach || coach.status !== "ACTIVE") {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }
  if (coach.isInternal) {
    return NextResponse.json(
      { error: "Kimchi coaches are assigned by your team. Contact support if you need a change." },
      { status: 400 },
    );
  }

  await assignCoachToClient({
    userId: me.id,
    coachProfileId,
    assignedByUserId: me.id,
    notes: "Added from coaching directory",
  });

  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({
    coaches,
    coachIds: coaches.map((c) => c.coachProfileId),
    coach,
  });
}

export async function DELETE(req: NextRequest) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== UserRole.USER) {
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
