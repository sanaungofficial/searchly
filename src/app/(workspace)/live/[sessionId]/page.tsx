import { notFound } from "next/navigation";
import { BetaFeaturePage } from "@/lib/beta-feature-page";
import { LiveSessionRoomPage } from "@/components/scout/live-session-room-page";
import { findLiveSessionByRouteId, toLiveSessionView } from "@/lib/live-session-db";
import { parseLiveSessionRouteId } from "@/lib/live-sessions";

export default async function LiveSessionPage({
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

  const row = await findLiveSessionByRouteId(routeId);
  if (!row) notFound();

  const session = toLiveSessionView(row);

  return (
    <BetaFeaturePage feature="live">
      <LiveSessionRoomPage session={session} joinAsGuest={sp.as === "guest"} />
    </BetaFeaturePage>
  );
}
