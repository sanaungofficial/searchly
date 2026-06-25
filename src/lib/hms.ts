import { SDK } from "@100mslive/server-sdk";

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

export function liveRoomName(sessionId: number): string {
  return `kimchi-live-${sessionId}`;
}

/** Idempotent: returns existing room or creates one for the session. */
export async function ensureLiveRoom(sessionId: number): Promise<string> {
  const hms = getHmsSdk();
  const name = liveRoomName(sessionId);

  try {
    const existing = await hms.rooms.retrieveByName(name);
    return existing.id;
  } catch {
    const created = await hms.rooms.create({
      name,
      description: `Kimchi live session ${sessionId}`,
      ...(process.env.HMS_TEMPLATE_ID?.trim()
        ? { template_id: process.env.HMS_TEMPLATE_ID.trim() }
        : {}),
    });
    return created.id;
  }
}

export function hmsHostRole(): string {
  return process.env.HMS_ROLE_HOST?.trim() || "host";
}

export function hmsGuestRole(): string {
  return process.env.HMS_ROLE_GUEST?.trim() || "guest";
}

export type LiveRoomStatus = {
  roomId: string | null;
  roomEnabled: boolean;
  activePeerCount: number;
  isActive: boolean;
};

export async function getLiveRoomId(sessionId: number): Promise<string | null> {
  if (!hmsConfigured()) return null;
  try {
    const hms = getHmsSdk();
    const room = await hms.rooms.retrieveByName(liveRoomName(sessionId));
    return room.id;
  } catch {
    return null;
  }
}

export async function getLiveRoomStatus(sessionId: number): Promise<LiveRoomStatus> {
  const empty: LiveRoomStatus = {
    roomId: null,
    roomEnabled: true,
    activePeerCount: 0,
    isActive: false,
  };
  if (!hmsConfigured()) return empty;

  const roomId = await getLiveRoomId(sessionId);
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
  try {
    const peers = await hms.activeRooms.retrieveActivePeers(roomId);
    activePeerCount = Object.keys(peers ?? {}).length;
  } catch {
    activePeerCount = 0;
  }

  return {
    roomId,
    roomEnabled,
    activePeerCount,
    isActive: activePeerCount > 0,
  };
}

/** Enable room and ensure it exists — call before coaches go live. */
export async function prepareLiveRoom(sessionId: number): Promise<string> {
  const roomId = await ensureLiveRoom(sessionId);
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
export async function endLiveRoom(sessionId: number, lock = true): Promise<void> {
  const roomId = await getLiveRoomId(sessionId);
  if (!roomId) return;

  const hms = getHmsSdk();
  try {
    await hms.activeRooms.end(roomId, {
      reason: "Session ended",
      lock,
    });
  } catch {
    // No active session — still disable below if requested
  }

  if (lock) {
    await hms.rooms.enableOrDisable(roomId, false);
  }
}
