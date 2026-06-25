import type { LiveSessionView } from "@/lib/live-session-types";

/** @deprecated Static catalog — use DB via /api/live/sessions */
export type LiveSession = LiveSessionView;

export { type LiveSessionView } from "@/lib/live-session-types";

export function parseLiveSessionRouteId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}
