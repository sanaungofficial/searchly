"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LiveSession } from "@/lib/live-sessions";
import { color, fontSans, border as B } from "@/lib/typography";

const LiveRoomClient = dynamic(
  () => import("@/components/scout/live-room-client").then((m) => m.LiveRoomClient),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: 48, textAlign: "center", fontFamily: fontSans, color: color.muted }}>
        Loading live room…
      </div>
    ),
  }
);

export function LiveSessionRoomPage({
  session,
  joinAsGuest = false,
}: {
  session: LiveSession;
  joinAsGuest?: boolean;
}) {
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: isMobile ? "calc(100vh - 56px)" : "100%",
        background: "#F7F5F2",
      }}
    >
      <div
        style={{
          padding: isMobile ? "10px 14px" : "12px 20px",
          borderBottom: B.line,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <Link
          href="/live"
          style={{
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            color: color.forest,
            textDecoration: "none",
          }}
        >
          ← Live sessions
        </Link>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <LiveRoomClient sessionId={session.id} sessionMeta={session} joinAsGuest={joinAsGuest} />
      </div>
    </div>
  );
}
