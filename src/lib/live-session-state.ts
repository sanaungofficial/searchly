import { LIVE_SESSIONS, type LiveSession } from "@/components/scout/workspace-data";
import { prisma } from "@/lib/prisma";

export const LIVE_SESSION_STATE_KEY = "LIVE_SESSIONS_RUNTIME";

export type LiveSessionRuntimeState = {
  /** Admin/coach marked these sessions as live now (overrides static catalog). */
  liveNowIds: number[];
  /** Sessions explicitly ended — hides from "live now" even if static catalog says live. */
  endedIds: number[];
};

export const DEFAULT_LIVE_SESSION_RUNTIME: LiveSessionRuntimeState = {
  liveNowIds: [],
  endedIds: [],
};

const STATE_META = {
  label: "Live sessions runtime",
  description: "Admin toggles for which Kimchi live sessions are live now.",
  category: "Live",
} as const;

function parseState(content: string | undefined | null): LiveSessionRuntimeState {
  if (!content) return { ...DEFAULT_LIVE_SESSION_RUNTIME };
  try {
    const parsed = JSON.parse(content) as Partial<LiveSessionRuntimeState>;
    const liveNowIds = Array.isArray(parsed.liveNowIds)
      ? parsed.liveNowIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : [];
    const endedIds = Array.isArray(parsed.endedIds)
      ? parsed.endedIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : [];
    return { liveNowIds, endedIds };
  } catch {
    return { ...DEFAULT_LIVE_SESSION_RUNTIME };
  }
}

export async function getLiveSessionRuntimeState(): Promise<LiveSessionRuntimeState> {
  const row = await prisma.promptConfig.findUnique({ where: { key: LIVE_SESSION_STATE_KEY } });
  return parseState(row?.content);
}

export async function saveLiveSessionRuntimeState(
  state: LiveSessionRuntimeState,
  updatedBy?: string
): Promise<LiveSessionRuntimeState> {
  const content = JSON.stringify(state, null, 2);
  await prisma.promptConfig.upsert({
    where: { key: LIVE_SESSION_STATE_KEY },
    update: { content, updatedBy: updatedBy ?? undefined },
    create: {
      key: LIVE_SESSION_STATE_KEY,
      label: STATE_META.label,
      description: STATE_META.description,
      category: STATE_META.category,
      content,
      defaultContent: JSON.stringify(DEFAULT_LIVE_SESSION_RUNTIME, null, 2),
      updatedBy,
    },
  });
  return state;
}

export function mergeSessionIsLive(session: LiveSession, state: LiveSessionRuntimeState): boolean {
  if (state.endedIds.includes(session.id)) return false;
  if (state.liveNowIds.includes(session.id)) return true;
  return session.isLive;
}

export async function getMergedLiveSessions(): Promise<LiveSession[]> {
  const state = await getLiveSessionRuntimeState();
  return LIVE_SESSIONS.map((session) => ({
    ...session,
    isLive: mergeSessionIsLive(session, state),
  }));
}

export async function markSessionLiveNow(sessionId: number, updatedBy?: string): Promise<void> {
  const state = await getLiveSessionRuntimeState();
  const endedIds = state.endedIds.filter((id) => id !== sessionId);
  const liveNowIds = state.liveNowIds.includes(sessionId)
    ? state.liveNowIds
    : [...state.liveNowIds, sessionId];
  await saveLiveSessionRuntimeState({ liveNowIds, endedIds }, updatedBy);
}

export async function markSessionEnded(sessionId: number, updatedBy?: string): Promise<void> {
  const state = await getLiveSessionRuntimeState();
  const liveNowIds = state.liveNowIds.filter((id) => id !== sessionId);
  const endedIds = state.endedIds.includes(sessionId)
    ? state.endedIds
    : [...state.endedIds, sessionId];
  await saveLiveSessionRuntimeState({ liveNowIds, endedIds }, updatedBy);
}
