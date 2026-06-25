import type { LiveSessionView } from "@/lib/live-session-types";

/** @deprecated Static catalog — use DB via /api/live/sessions */
export type LiveSession = LiveSessionView;

export { type LiveSessionView } from "@/lib/live-session-types";

export function parseLiveSessionRouteId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** URL segment for /live/[sessionId] — prefer legacy numeric id for seeded 100ms rooms. */
export function liveSessionRouteId(session: {
  id: string;
  legacyNumericId?: number | null;
}): string {
  return session.legacyNumericId != null ? String(session.legacyNumericId) : session.id;
}
