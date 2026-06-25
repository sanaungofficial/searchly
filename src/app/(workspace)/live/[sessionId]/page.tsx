import { notFound } from "next/navigation";
import { BetaFeaturePage } from "@/lib/beta-feature-page";
import { LiveSessionRoomPage } from "@/components/scout/live-session-room-page";
import { getLiveSessionById, parseLiveSessionId } from "@/lib/live-sessions";

export default async function LiveSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { sessionId: raw } = await params;
  const sp = await searchParams;
  const sessionId = parseLiveSessionId(raw);
  if (sessionId == null) notFound();

  const session = getLiveSessionById(sessionId);
  if (!session) notFound();

  return (
    <BetaFeaturePage feature="live">
      <LiveSessionRoomPage session={session} joinAsGuest={sp.as === "guest"} />
    </BetaFeaturePage>
  );
}
