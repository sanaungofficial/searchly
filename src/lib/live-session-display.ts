import type { LiveSession, LiveSessionStatus } from "@prisma/client";
import type { LiveSessionView } from "@/lib/live-session-types";

const DISPLAY_TZ = "America/New_York";

export function sessionIsLive(status: LiveSessionStatus): boolean {
  return status === "LIVE";
}

export function formatSessionDateRange(start: Date, end: Date): { date: string; time: string } {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TZ, timeZoneName: "short" })
    .formatToParts(start)
    .find((p) => p.type === "timeZoneName")?.value ?? "ET";

  return {
    date: dateFmt.format(start),
    time: `${timeFmt.format(start)} – ${timeFmt.format(end)} ${tz}`,
  };
}

export function formatStartsIn(start: Date, status: LiveSessionStatus, now = new Date()): string {
  if (status === "LIVE") return "Live now";
  if (status === "ENDED") return "Ended";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "DRAFT") return "Draft";

  const ms = start.getTime() - now.getTime();
  if (ms <= 0) return "Starting soon";

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(ms / dayMs);
  if (days === 0) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours <= 0) {
      const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
      return `In ${mins} min`;
    }
    return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (days === 1) {
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: DISPLAY_TZ,
      hour: "numeric",
      minute: "2-digit",
    }).format(start);
    return `Tomorrow · ${time} ET`;
  }
  return `In ${days} days`;
}

export function hostInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

type MapSessionArgs = {
  registrationCount: number;
  canHost?: boolean;
  isRegistered?: boolean;
  activePeerCount?: number;
  roomEnabled?: boolean;
  coachSlug?: string | null;
};

export function mapLiveSessionToView(
  row: LiveSession,
  args: MapSessionArgs
): LiveSessionView {
  const { date, time } = formatSessionDateRange(row.scheduledStart, row.scheduledEnd);
  return {
    id: row.id,
    legacyNumericId: row.legacyNumericId,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    isLive: sessionIsLive(row.status),
    isFeaturedWeekly: row.isFeaturedWeekly,
    startsIn: formatStartsIn(row.scheduledStart, row.status),
    date,
    time,
    registered: args.registrationCount,
    host: row.hostName,
    hostInitials: row.hostInitials ?? hostInitialsFromName(row.hostName),
    hostRole: row.hostRole ?? "",
    hostRating: row.hostRating,
    hostReviews: row.hostReviewCount,
    coachProfileId: row.coachProfileId,
    bgColor: row.bgColor,
    accentColor: row.accentColor,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd.toISOString(),
    wentLiveAt: row.wentLiveAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    canHost: args.canHost,
    isRegistered: args.isRegistered,
    activePeerCount: args.activePeerCount,
    roomEnabled: args.roomEnabled,
    peakViewers: row.peakViewers,
    totalUniqueJoins: row.totalUniqueJoins,
    recordingUrl: row.recordingUrl,
    hlsPlaybackUrl: row.hlsPlaybackUrl,
    coachSlug: args.coachSlug ?? null,
  };
}
