import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createCoachClientSessionNote,
  listCoachClientSessionNotes,
} from "@/lib/coach-client-session-notes";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  const coachProfileId = req.nextUrl.searchParams.get("coachProfileId")?.trim() || undefined;

  const notes = await listCoachClientSessionNotes({ clientUserId, coachProfileId });
  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  let body: {
    coachProfileId?: string;
    sessionNotes?: string;
    homework?: string;
    coachBookingId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.coachProfileId) {
    return NextResponse.json({ error: "coachProfileId is required" }, { status: 400 });
  }

  try {
    const note = await createCoachClientSessionNote({
      coachProfileId: body.coachProfileId,
      clientUserId,
      createdByUserId: admin.id,
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
