import { LIVE_SESSIONS, type LiveSession } from "@/components/scout/workspace-data";
import { getMergedLiveSessions, mergeSessionIsLive, getLiveSessionRuntimeState } from "@/lib/live-session-state";

export { LIVE_SESSIONS, type LiveSession };

export async function getLiveSessionByIdAsync(sessionId: number): Promise<LiveSession | undefined> {
  const sessions = await getMergedLiveSessions();
  return sessions.find((s) => s.id === sessionId);
}

export function getLiveSessionById(sessionId: number): LiveSession | undefined {
  return LIVE_SESSIONS.find((s) => s.id === sessionId);
}

export async function getLiveSessionByIdMerged(sessionId: number): Promise<LiveSession | undefined> {
  const base = getLiveSessionById(sessionId);
  if (!base) return undefined;
  const state = await getLiveSessionRuntimeState();
  return { ...base, isLive: mergeSessionIsLive(base, state) };
}

export function parseLiveSessionId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 0) return null;
  return getLiveSessionById(id) ? id : null;
}
