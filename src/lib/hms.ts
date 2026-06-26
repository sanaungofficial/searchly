import { SDK } from "@100mslive/server-sdk";
import { liveSessionRoomKey, type LiveSessionRecord } from "@/lib/live-session-db";

let sdk: SDK | null = null;

export function getHmsSdk(): SDK {
  if (sdk) return sdk;
  const accessKey = process.env.HMS_ACCESS_KEY?.trim();
  const secret = process.env.HMS_SECRET?.trim();
  if (!accessKey || !secret) {
    throw new Error("HMS_ACCESS_KEY and HMS_SECRET must be set");
  }
  sdk = new SDK(accessKey, secret);
  return sdk;
}

export function hmsConfigured(): boolean {
  return Boolean(process.env.HMS_ACCESS_KEY?.trim() && process.env.HMS_SECRET?.trim());
}

export function hmsHostRole(): string {
  return process.env.HMS_ROLE_HOST?.trim() || "host";
}

export function hmsGuestRole(): string {
  return process.env.HMS_ROLE_GUEST?.trim() || "guest";
}

export function hmsViewerRole(): string {
  return process.env.HMS_ROLE_VIEWER?.trim() || "viewer";
}

export function hmsModeratorRole(): string {
  return process.env.HMS_ROLE_MODERATOR?.trim() || hmsHostRole();
}

export type LiveRoomStatus = {
  roomId: string | null;
  roomEnabled: boolean;
  activePeerCount: number;
  isActive: boolean;
  peers?: Array<{ id: string; name: string; role: string }>;
};

function roomNameFor(session: Pick<LiveSessionRecord, "id" | "legacyNumericId">): string {
  return liveSessionRoomKey(session);
}

/** Idempotent: returns existing room or creates one for the session. */
export async function ensureLiveRoom(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId" | "title">
): Promise<string> {
  const hms = getHmsSdk();
  const name = roomNameFor(session);

  try {
    const existing = await hms.rooms.retrieveByName(name);
    return existing.id;
  } catch {
    const created = await hms.rooms.create({
      name,
      description: session.title,
      ...(process.env.HMS_TEMPLATE_ID?.trim()
        ? { template_id: process.env.HMS_TEMPLATE_ID.trim() }
        : {}),
    });
    return created.id;
  }
}

export async function getLiveRoomId(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">
): Promise<string | null> {
  if (!hmsConfigured()) return null;
  try {
    const hms = getHmsSdk();
    const room = await hms.rooms.retrieveByName(roomNameFor(session));
    return room.id;
  } catch {
    return null;
  }
}

export async function getLiveRoomStatus(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">
): Promise<LiveRoomStatus> {
  const empty: LiveRoomStatus = {
    roomId: null,
    roomEnabled: true,
    activePeerCount: 0,
    isActive: false,
    peers: [],
  };
  if (!hmsConfigured()) return empty;

  const roomId = await getLiveRoomId(session);
  if (!roomId) return empty;

  const hms = getHmsSdk();
  let roomEnabled = true;
  try {
    const room = await hms.rooms.retrieveById(roomId);
    roomEnabled = room.enabled ?? true;
  } catch {
    // keep defaults
  }

  let activePeerCount = 0;
  let peers: LiveRoomStatus["peers"] = [];
  try {
    const peerMap = await hms.activeRooms.retrieveActivePeers(roomId);
    peers = Object.entries(peerMap ?? {}).map(([id, peer]) => ({
      id,
      name: peer.name ?? "Guest",
      role: peer.role ?? "guest",
    }));
    activePeerCount = peers.length;
  } catch {
    activePeerCount = 0;
    peers = [];
  }

  return {
    roomId,
    roomEnabled,
    activePeerCount,
    isActive: activePeerCount > 0,
    peers,
  };
}

/** Enable room and ensure it exists — call before coaches go live. */
export async function prepareLiveRoom(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId" | "title">
): Promise<string> {
  const roomId = await ensureLiveRoom(session);
  const hms = getHmsSdk();
  await hms.rooms.enableOrDisable(roomId, true);
  try {
    await hms.roomCodes.create(roomId);
  } catch {
    // Room codes may already exist
  }
  return roomId;
}

/** End active peers and optionally lock the room. */
export async function endLiveRoom(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">,
  lock = true
): Promise<void> {
  const roomId = await getLiveRoomId(session);
  if (!roomId) return;

  const hms = getHmsSdk();
  try {
    await hms.activeRooms.end(roomId, {
      reason: "Session ended",
      lock,
    });
  } catch {
    // No active session
  }

  if (lock) {
    await hms.rooms.enableOrDisable(roomId, false);
  }
}

/** Start composite room recording (requires template recording enabled). */
export async function startLiveRecording(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">
): Promise<string | null> {
  if (!hmsConfigured()) return null;
  const roomId = await getLiveRoomId(session);
  if (!roomId) return null;

  const hms = getHmsSdk();
  try {
    const recording = await hms.recordings.start(roomId, {});
    return recording.id ?? null;
  } catch (err) {
    console.error("[hms/recording start]", err);
    return null;
  }
}

/** Stop all recordings in room. */
export async function stopLiveRecording(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">
): Promise<void> {
  if (!hmsConfigured()) return;
  const roomId = await getLiveRoomId(session);
  if (!roomId) return;

  const hms = getHmsSdk();
  try {
    await hms.recordings.stopAll(roomId);
  } catch {
    // No active recording
  }
}

/** Start HLS live stream for large audiences (viewer role in template). */
export async function startHlsLiveStream(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId" | "title">
): Promise<{ streamId: string | null; playbackUrl: string | null }> {
  if (!hmsConfigured()) return { streamId: null, playbackUrl: null };
  const roomId = await ensureLiveRoom(session);
  const hms = getHmsSdk();
  try {
    const stream = await hms.liveStreams.start(roomId, {
      recording: { hls_vod: true },
    });
    const playbackUrl =
      (stream as { url?: string }).url ??
      (stream as { playback?: { url?: string } }).playback?.url ??
      null;
    return { streamId: stream.id ?? null, playbackUrl };
  } catch (err) {
    console.error("[hms/hls start]", err);
    return { streamId: null, playbackUrl: null };
  }
}

export async function stopHlsLiveStream(roomId: string): Promise<void> {
  if (!hmsConfigured()) return;
  const hms = getHmsSdk();
  try {
    await hms.liveStreams.stopAll(roomId);
  } catch {
    // No active stream
  }
}

/** Remove a peer from active room (moderator action). */
export async function removeLivePeer(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">,
  peerId: string,
  reason = "Removed by host"
): Promise<void> {
  const roomId = await getLiveRoomId(session);
  if (!roomId) return;
  const hms = getHmsSdk();
  await hms.activeRooms.removePeer(roomId, { peer_id: peerId, reason });
}

/** Update peak viewer count from active room. */
export async function snapshotLiveRoomMetrics(
  session: Pick<LiveSessionRecord, "id" | "legacyNumericId">
): Promise<{ activePeerCount: number; peakViewers: number }> {
  const room = await getLiveRoomStatus(session);
  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.liveSession.findUnique({ where: { id: session.id } });
  const peak = Math.max(room.activePeerCount, row?.peakViewers ?? 0);
  if (peak > (row?.peakViewers ?? 0)) {
    await prisma.liveSession.update({
      where: { id: session.id },
      data: { peakViewers: peak },
    });
  }
  return { activePeerCount: room.activePeerCount, peakViewers: peak };
}
