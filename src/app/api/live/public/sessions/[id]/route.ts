import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findLiveSessionWithCoHosts,
  toLiveSessionView,
} from "@/lib/live-session-db";
import { parseLiveSessionRouteId } from "@/lib/live-sessions";

const PUBLIC_STATUSES = new Set(["SCHEDULED", "LIVE", "ENDED"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const routeId = parseLiveSessionRouteId(raw);
  if (!routeId) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const row = await findLiveSessionWithCoHosts(routeId);
  if (!row || !PUBLIC_STATUSES.has(row.status)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (row.status === "ENDED" && (!row.replayEnabled || !row.recordingUrl)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let coachSlug: string | null = null;
  if (row.coachProfileId) {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: row.coachProfileId },
      select: { slug: true },
    });
    coachSlug = coach?.slug ?? null;
  }

  const coHosts = row.coHosts.map((h) => ({
    id: h.id,
    displayName: h.displayName,
    email: h.email,
    coachProfileId: h.coachProfileId,
    coachSlug: h.coachProfile?.slug ?? null,
  }));

  const session = toLiveSessionView(row, { coachSlug, coHosts });

  const registrants = await prisma.liveSessionRegistration.findMany({
    where: { liveSessionId: row.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    session,
    registrantPreview: registrants.map((r) => ({
      name: r.user.name ?? "Guest",
    })),
    registrantCount: row._count.registrations,
  });
}
