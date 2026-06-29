import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  assignCoachToClient,
  getAssignedClientsForCoach,
  removeCoachAssignment,
} from "@/lib/coach-client-assignment";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: coachProfileId } = await params;
  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const assignments = await getAssignedClientsForCoach(coachProfileId);
  return NextResponse.json({ assignments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: coachProfileId } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, displayName: true },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const client = await prisma.user.findFirst({
    where: { id: userId, role: "USER" },
    select: { id: true, email: true, name: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await assignCoachToClient({
    userId,
    coachProfileId,
    assignedByUserId: admin.id,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  const assignments = await getAssignedClientsForCoach(coachProfileId);
  return NextResponse.json({ assignments, client });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: coachProfileId } = await params;
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  await removeCoachAssignment(userId, coachProfileId);
  const assignments = await getAssignedClientsForCoach(coachProfileId);
  return NextResponse.json({ assignments });
}
