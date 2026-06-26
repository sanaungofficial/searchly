import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { disconnectCoachNylas } from "@/lib/coach-scheduler-sync";
import { isNylasConfigured } from "@/lib/nylas";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const { id } = await params;
  await disconnectCoachNylas(id);
  return NextResponse.json({ ok: true });
}
