import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachLiveAuth } from "@/lib/coach-live-auth";

/** Active coaches for co-host picker (staff only). */
export async function GET(request: Request) {
  const auth = await requireCoachLiveAuth(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const coaches = await prisma.coachProfile.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, displayName: true, slug: true },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ coaches });
}
