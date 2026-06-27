import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicLiveEventPage } from "@/components/scout/public-live-event-page";
import {
  findLiveSessionWithCoHosts,
  toLiveSessionView,
} from "@/lib/live-session-db";
import { parseLiveSessionRouteId } from "@/lib/live-sessions";

const PUBLIC_STATUSES = new Set(["SCHEDULED", "LIVE", "ENDED"]);

export default async function LiveSessionPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { sessionId: raw } = await params;
  const sp = await searchParams;
  const routeId = parseLiveSessionRouteId(raw);
  if (!routeId) notFound();

  const row = await findLiveSessionWithCoHosts(routeId);
  if (!row || !PUBLIC_STATUSES.has(row.status)) notFound();
  if (row.status === "ENDED" && (!row.replayEnabled || !row.recordingUrl)) notFound();

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

  return <PublicLiveEventPage session={session} joinAsGuest={sp.as === "guest"} />;
}
