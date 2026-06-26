import { NextRequest, NextResponse } from "next/server";
import { getClientCoachingUser } from "@/lib/coach-api";
import { getAssignedCoachesForUser } from "@/lib/coach-client-assignment";

export async function GET(request: NextRequest) {
  const me = await getClientCoachingUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({ coaches, coachIds: coaches.map((c) => c.coachProfileId) });
}
