import { LIVE_SESSIONS, type LiveSession } from "@/components/scout/workspace-data";

export { LIVE_SESSIONS, type LiveSession };

export function getLiveSessionById(sessionId: number): LiveSession | undefined {
  return LIVE_SESSIONS.find((s) => s.id === sessionId);
}

export function parseLiveSessionId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 0) return null;
  return getLiveSessionById(id) ? id : null;
}
