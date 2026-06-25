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
