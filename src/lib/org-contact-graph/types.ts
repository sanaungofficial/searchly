export type OrgContactStrengthFactors = {
  emailCount: number;
  meetingCount: number;
  inboundCount: number;
  outboundCount: number;
  oneOnOneMeetingCount: number;
  groupMeetingCount: number;
  recentSubjects: string[];
  recentMeetings: string[];
  lastEmailAt: string | null;
  lastMeetingAt: string | null;
};

export const EMPTY_STRENGTH_FACTORS: OrgContactStrengthFactors = {
  emailCount: 0,
  meetingCount: 0,
  inboundCount: 0,
  outboundCount: 0,
  oneOnOneMeetingCount: 0,
  groupMeetingCount: 0,
  recentSubjects: [],
  recentMeetings: [],
  lastEmailAt: null,
  lastMeetingAt: null,
};

export function parseStrengthFactors(value: unknown): OrgContactStrengthFactors {
  if (!value || typeof value !== "object") return { ...EMPTY_STRENGTH_FACTORS };
  const row = value as Record<string, unknown>;
  return {
    emailCount: typeof row.emailCount === "number" ? row.emailCount : 0,
    meetingCount: typeof row.meetingCount === "number" ? row.meetingCount : 0,
    inboundCount: typeof row.inboundCount === "number" ? row.inboundCount : 0,
    outboundCount: typeof row.outboundCount === "number" ? row.outboundCount : 0,
    oneOnOneMeetingCount: typeof row.oneOnOneMeetingCount === "number" ? row.oneOnOneMeetingCount : 0,
    groupMeetingCount: typeof row.groupMeetingCount === "number" ? row.groupMeetingCount : 0,
    recentSubjects: Array.isArray(row.recentSubjects)
      ? row.recentSubjects.filter((s): s is string => typeof s === "string").slice(0, 10)
      : [],
    recentMeetings: Array.isArray(row.recentMeetings)
      ? row.recentMeetings.filter((s): s is string => typeof s === "string").slice(0, 10)
      : [],
    lastEmailAt: typeof row.lastEmailAt === "string" ? row.lastEmailAt : null,
    lastMeetingAt: typeof row.lastMeetingAt === "string" ? row.lastMeetingAt : null,
  };
}

export function mergeRecentStrings(existing: string[], incoming: string | null | undefined, cap = 10): string[] {
  if (!incoming?.trim()) return existing.slice(0, cap);
  const next = [incoming.trim().slice(0, 240), ...existing.filter((s) => s !== incoming.trim())];
  return next.slice(0, cap);
}
