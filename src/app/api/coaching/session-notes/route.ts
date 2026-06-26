import { NextRequest, NextResponse } from "next/server";
import { getClientCoachingUser } from "@/lib/coach-api";
import { listCoachClientSessionNotes } from "@/lib/coach-client-session-notes";

export async function GET(req: NextRequest) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coachProfileId = req.nextUrl.searchParams.get("coachProfileId")?.trim() || undefined;
  const notes = await listCoachClientSessionNotes({
    clientUserId: me.id,
    coachProfileId,
  });
  return NextResponse.json({ notes });
}
