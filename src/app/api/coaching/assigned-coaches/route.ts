import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/coach-api";
import { getAssignedCoachesForUser } from "@/lib/coach-client-assignment";

export async function GET() {
  const me = await getAuthenticatedDbUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coaches = await getAssignedCoachesForUser(me.id);
  return NextResponse.json({ coaches });
}
