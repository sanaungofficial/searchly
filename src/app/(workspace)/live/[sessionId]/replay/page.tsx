import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BetaFeaturePage } from "@/lib/beta-feature-page";
import { LiveSessionReplayPage } from "@/components/scout/live-session-replay-page";
import { findLiveSessionByRouteId, toLiveSessionView } from "@/lib/live-session-db";
import { parseLiveSessionRouteId } from "@/lib/live-sessions";

export default async function LiveSessionReplayRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId: raw } = await params;
  const routeId = parseLiveSessionRouteId(raw);
  if (!routeId) notFound();

  const row = await findLiveSessionByRouteId(routeId);
  if (!row) notFound();

  if (row.status !== "ENDED" && row.status !== "CANCELLED") {
    redirect(`/live/${raw}`);
  }

  let coachSlug: string | null = null;
  if (row.coachProfileId) {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: row.coachProfileId },
      select: { slug: true },
    });
    coachSlug = coach?.slug ?? null;
  }

  const session = toLiveSessionView(row, { coachSlug });
  const replayUrl = row.recordingUrl ?? row.hlsPlaybackUrl ?? null;

  return (
    <BetaFeaturePage feature="live">
      <LiveSessionReplayPage session={session} replayUrl={replayUrl} />
    </BetaFeaturePage>
  );
}
