import type { LiveSessionStatus } from "@prisma/client";

/** Client-safe view of a live session (API + UI). */
export type LiveSessionView = {
  id: string;
  legacyNumericId: number | null;
  title: string;
  description: string;
  category: string;
  status: LiveSessionStatus;
  isLive: boolean;
  isFeaturedWeekly: boolean;
  startsIn: string;
  date: string;
  time: string;
  registered: number;
  host: string;
  hostInitials: string;
  hostRole: string;
  hostRating: number | null;
  hostReviews: number;
  coachProfileId: string | null;
  bgColor: string;
  accentColor: string;
  scheduledStart: string;
  scheduledEnd: string;
  wentLiveAt: string | null;
  endedAt: string | null;
  canHost?: boolean;
  isRegistered?: boolean;
  activePeerCount?: number;
  roomEnabled?: boolean;
  peakViewers?: number;
  totalUniqueJoins?: number;
  recordingUrl?: string | null;
  hlsPlaybackUrl?: string | null;
  coachSlug?: string | null;
};

export type LiveSessionRoomKey = {
  id: string;
  legacyNumericId: number | null;
};

export type AdminLiveOverview = {
  liveNowCount: number;
  scheduledCount: number;
  totalRegistrations: number;
  activeAttendees: number;
};
