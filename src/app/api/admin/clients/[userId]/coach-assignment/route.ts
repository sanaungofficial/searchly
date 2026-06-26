import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assignCoachToClient, removeCoachAssignment } from "@/lib/coach-client-assignment";
import { fetchAdminClientById } from "@/lib/admin-client-provision";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const coachProfileId = String(body.coachProfileId ?? "").trim();
  if (!coachProfileId) {
    return NextResponse.json({ error: "coachProfileId required" }, { status: 400 });
  }

  const client = await prisma.user.findFirst({
    where: { id: userId, role: "USER" },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, displayName: true, isInternal: true },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  await assignCoachToClient({
    userId,
    coachProfileId,
    assignedByUserId: admin.id,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  const updated = await fetchAdminClientById(userId);
  return NextResponse.json({ client: updated, coach });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const sp = req.nextUrl.searchParams;
  const coachProfileId = sp.get("coachProfileId")?.trim();
  if (!coachProfileId) {
    return NextResponse.json({ error: "coachProfileId required" }, { status: 400 });
  }

  await removeCoachAssignment(userId, coachProfileId);
  const updated = await fetchAdminClientById(userId);
  return NextResponse.json({ client: updated });
}
