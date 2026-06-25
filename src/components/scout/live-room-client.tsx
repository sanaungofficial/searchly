"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HMSRoomProvider,
  selectIsConnectedToRoom,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  selectPeers,
  useHMSActions,
  useHMSStore,
  useVideo,
  type HMSPeer,
} from "@100mslive/react-sdk";
import type { LiveSession } from "@/lib/live-sessions";
import { color, fontSans, surface, border as B } from "@/lib/typography";

type JoinPayload = {
  authToken: string;
  userName: string;
  role: string;
  isHost?: boolean;
  canHost?: boolean;
  session: { id: number; title: string; host: string; isLive: boolean };
};

function peerVideoTrackId(peer: HMSPeer): string {
  const track = peer.videoTrack;
  if (!track) return "";
  if (typeof track === "string") return track;
  if (typeof track === "object" && "id" in track && typeof track.id === "string") {
    return track.id;
  }
  return "";
}

function PeerTile({ peer }: { peer: HMSPeer }) {
  const trackId = peerVideoTrackId(peer);
  const { videoRef } = useVideo({ trackId: trackId || undefined });

  return (
    <div
      style={{
        position: "relative",
        background: "#1A1A1A",
        aspectRatio: "16 / 10",
        minHeight: 160,
        overflow: "hidden",
        border: B.lineStrong,
      }}
    >
      {trackId ? (
        <video
          ref={videoRef}
          autoPlay
          muted={peer.isLocal}
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: color.forest,
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: 28, fontWeight: 700, color: color.gold }}>
            {(peer.name || "?").slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          padding: "4px 8px",
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontFamily: fontSans,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {peer.name}
        {peer.isLocal ? " (you)" : ""}
      </div>
    </div>
  );
}

function LiveConference({
  joinPayload,
  sessionMeta,
  onLeave,
}: {
  joinPayload: JoinPayload;
  sessionMeta: LiveSession;
  onLeave: () => void;
}) {
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const audioOn = useHMSStore(selectIsLocalAudioEnabled);
  const videoOn = useHMSStore(selectIsLocalVideoEnabled);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hmsActions.join({
          authToken: joinPayload.authToken,
          userName: joinPayload.userName,
        });
        if (!cancelled) setJoining(false);
      } catch (e) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : typeof e === "object" && e !== null && "message" in e
                ? String((e as { message: unknown }).message)
                : "Could not join the room";
          setJoinError(message);
          setJoining(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      void hmsActions.leave();
    };
  }, [hmsActions, joinPayload.authToken, joinPayload.userName]);

  const handleLeave = useCallback(async () => {
    await hmsActions.leave();
    onLeave();
  }, [hmsActions, onLeave]);

  if (joinError) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, color: "#C4574A", marginBottom: 16 }}>{joinError}</p>
        <button type="button" onClick={onLeave} style={secondaryBtnStyle}>
          Back to sessions
        </button>
      </div>
    );
  }

  if (joining || !isConnected) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, fontSize: 15, color: color.muted }}>Connecting to live room…</p>
      </div>
    );
  }

  const isHost =
    joinPayload.isHost ??
    joinPayload.role === "host" ||
    joinPayload.role.includes("broadcaster");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          padding: "14px 20px",
          background: sessionMeta.bgColor,
          color: sessionMeta.accentColor,
          borderBottom: B.lineStrong,
          flexShrink: 0,
        }}
      >
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px", opacity: 0.85 }}>
          {sessionMeta.isLive ? "● Live now" : sessionMeta.category}
        </p>
        <h1 style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
          {sessionMeta.title}
        </h1>
        <p style={{ fontFamily: fontSans, fontSize: 13, margin: "6px 0 0", opacity: 0.8 }}>
          with {sessionMeta.host} · you joined as {isHost ? "host" : "participant"}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
          background: surface.inset,
        }}
      >
        {peers.map((peer) => (
          <PeerTile key={peer.id} peer={peer} />
        ))}
      </div>

      <div
        style={{
          padding: "12px 16px max(12px, env(safe-area-inset-bottom))",
          borderTop: B.line,
          background: surface.card,
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={() => void hmsActions.setLocalAudioEnabled(!audioOn)} style={controlBtnStyle}>
          {audioOn ? "Mute" : "Unmute"}
        </button>
        <button type="button" onClick={() => void hmsActions.setLocalVideoEnabled(!videoOn)} style={controlBtnStyle}>
          {videoOn ? "Stop video" : "Start video"}
        </button>
        {isHost && (
          <button
            type="button"
            onClick={() => void hmsActions.setScreenShareEnabled(true)}
            style={controlBtnStyle}
          >
            Share screen
          </button>
        )}
        <button type="button" onClick={() => void handleLeave()} style={{ ...controlBtnStyle, background: "#C4574A", color: "#fff", borderColor: "#C4574A" }}>
          Leave
        </button>
      </div>
    </div>
  );
}

const controlBtnStyle: React.CSSProperties = {
  padding: "10px 16px",
  minHeight: 44,
  background: surface.card,
  border: B.lineStrong,
  borderRadius: 0,
  fontFamily: fontSans,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  color: color.forest,
};

const secondaryBtnStyle: React.CSSProperties = {
  ...controlBtnStyle,
  background: color.forest,
  color: color.gold,
};

export function LiveRoomClient({
  sessionId,
  sessionMeta,
  joinAsGuest = false,
}: {
  sessionId: string;
  sessionMeta: LiveSession;
  joinAsGuest?: boolean;
}) {
  const router = useRouter();
  const [joinPayload, setJoinPayload] = useState<JoinPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/live/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          sessionId: sessionMeta.legacyNumericId != null ? String(sessionMeta.legacyNumericId) : sessionId,
          ...(joinAsGuest ? { intent: "guest" } : {}),
        }),
        });
        const data = (await res.json().catch(() => ({}))) as JoinPayload & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not join session");
        }
        const authToken =
          typeof data.authToken === "string"
            ? data.authToken
            : (data.authToken as { token?: string } | undefined)?.token;
        if (!authToken) {
          throw new Error("Invalid live session token from server");
        }
        if (!cancelled) {
          setJoinPayload({
            ...data,
            authToken,
            userName: String(data.userName ?? "Guest"),
            role: String(data.role ?? "guest"),
            isHost: data.isHost,
            canHost: data.canHost,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not join session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, joinAsGuest]);

  const goBack = useCallback(() => {
    router.push("/live");
  }, [router]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, color: color.muted }}>Preparing your seat…</p>
      </div>
    );
  }

  if (error || !joinPayload) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, color: "#C4574A", marginBottom: 16 }}>{error ?? "Unable to join"}</p>
        <button type="button" onClick={goBack} style={secondaryBtnStyle}>
          Back to sessions
        </button>
      </div>
    );
  }

  return (
    <HMSRoomProvider>
      <LiveConference joinPayload={joinPayload} sessionMeta={sessionMeta} onLeave={goBack} />
    </HMSRoomProvider>
  );
}
