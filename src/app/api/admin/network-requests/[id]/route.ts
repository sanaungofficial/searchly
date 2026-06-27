import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NetworkJobRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";

const VALID_STATUSES = new Set<NetworkJobRequestStatus>([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

type PatchBody = {
  status?: NetworkJobRequestStatus;
  adminNotes?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const data: {
    status?: NetworkJobRequestStatus;
    adminNotes?: string | null;
    handledByUserId?: string;
    handledAt?: Date;
  } = {};

  if (body.status) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === "COMPLETED" || body.status === "CANCELLED") {
      data.handledByUserId = admin.id;
      data.handledAt = new Date();
    }
  }

  if (body.adminNotes !== undefined) {
    data.adminNotes = body.adminNotes.trim() || null;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.networkJobRequest.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ request: updated });
  } catch {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
}
