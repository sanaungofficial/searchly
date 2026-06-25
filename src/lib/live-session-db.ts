import type { LiveSessionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapLiveSessionToView } from "@/lib/live-session-display";
import type { AdminLiveOverview, LiveSessionRoomKey, LiveSessionView } from "@/lib/live-session-types";

export type LiveSessionRecord = Prisma.LiveSessionGetPayload<{
  include: { _count: { select: { registrations: true } } };
}>;

const sessionInclude = {
  _count: { select: { registrations: true } },
} as const;

export async function findLiveSessionByRouteId(routeId: string) {
  const numeric = Number.parseInt(routeId, 10);
  if (Number.isFinite(numeric) && String(numeric) === routeId.trim()) {
    const byLegacy = await prisma.liveSession.findUnique({
      where: { legacyNumericId: numeric },
      include: sessionInclude,
    });
    if (byLegacy) return byLegacy;
  }
  return prisma.liveSession.findUnique({
    where: { id: routeId },
    include: sessionInclude,
  });
}

export async function listPublicLiveSessions(): Promise<LiveSessionRecord[]> {
  return prisma.liveSession.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    include: sessionInclude,
    orderBy: [{ status: "asc" }, { scheduledStart: "asc" }],
  });
}

export async function listAdminLiveSessions(): Promise<LiveSessionRecord[]> {
  return prisma.liveSession.findMany({
    include: sessionInclude,
    orderBy: [{ status: "asc" }, { scheduledStart: "desc" }],
  });
}

export function liveSessionRoomKey(session: LiveSessionRoomKey): string {
  return session.legacyNumericId != null
    ? `kimchi-live-${session.legacyNumericId}`
    : `kimchi-live-${session.id}`;
}

export function toLiveSessionView(
  row: LiveSessionRecord,
  extras: {
    canHost?: boolean;
    isRegistered?: boolean;
    activePeerCount?: number;
    roomEnabled?: boolean;
  } = {}
): LiveSessionView {
  return mapLiveSessionToView(row, {
    registrationCount: row._count.registrations,
    ...extras,
  });
}

export type CreateLiveSessionInput = {
  title: string;
  description: string;
  category?: string;
  coachProfileId?: string | null;
  hostName?: string;
  hostInitials?: string;
  hostRole?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  isFeaturedWeekly?: boolean;
  bgColor?: string;
  accentColor?: string;
  status?: LiveSessionStatus;
};

export async function createLiveSession(input: CreateLiveSessionInput) {
  let hostName = input.hostName?.trim() ?? "";
  let hostInitials = input.hostInitials;
  let hostRole = input.hostRole;
  const hostRating: number | null = null;
  let hostReviewCount = 0;

  if (input.coachProfileId) {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: input.coachProfileId },
      include: { _count: { select: { reviews: true } } },
    });
    if (coach) {
      hostName = coach.displayName;
      hostInitials = hostInitials ?? coach.displayName.slice(0, 2).toUpperCase();
      hostRole = hostRole ?? coach.headline ?? coach.currentRole ?? undefined;
      hostReviewCount = coach._count.reviews;
    }
  }

  if (!hostName) {
    throw new Error("Host name or coach is required");
  }

  return prisma.liveSession.create({
    data: {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category?.trim() || "General",
      coachProfileId: input.coachProfileId ?? null,
      hostName,
      hostInitials,
      hostRole,
      hostRating,
      hostReviewCount,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      isFeaturedWeekly: input.isFeaturedWeekly ?? false,
      bgColor: input.bgColor ?? "#1A3A2F",
      accentColor: input.accentColor ?? "#E8D5A3",
      status: input.status ?? "SCHEDULED",
    },
    include: sessionInclude,
  });
}

export type UpdateLiveSessionInput = Partial<CreateLiveSessionInput>;

export async function updateLiveSession(id: string, input: UpdateLiveSessionInput) {
  const data: Prisma.LiveSessionUpdateInput = {};

  if (input.title != null) data.title = input.title.trim();
  if (input.description != null) data.description = input.description.trim();
  if (input.category != null) data.category = input.category.trim();
  if (input.scheduledStart != null) data.scheduledStart = input.scheduledStart;
  if (input.scheduledEnd != null) data.scheduledEnd = input.scheduledEnd;
  if (input.isFeaturedWeekly != null) data.isFeaturedWeekly = input.isFeaturedWeekly;
  if (input.bgColor != null) data.bgColor = input.bgColor;
  if (input.accentColor != null) data.accentColor = input.accentColor;
  if (input.status != null) data.status = input.status;

  if (input.coachProfileId !== undefined) {
    data.coachProfile = input.coachProfileId
      ? { connect: { id: input.coachProfileId } }
      : { disconnect: true };
    if (input.coachProfileId) {
      const coach = await prisma.coachProfile.findUnique({
        where: { id: input.coachProfileId },
        include: { _count: { select: { reviews: true } } },
      });
      if (coach) {
        data.hostName = input.hostName?.trim() || coach.displayName;
        data.hostInitials = input.hostInitials ?? coach.displayName.slice(0, 2).toUpperCase();
        data.hostRole = input.hostRole ?? coach.headline ?? coach.currentRole ?? undefined;
        data.hostReviewCount = coach._count.reviews;
      }
    }
  }

  if (input.hostName != null) data.hostName = input.hostName.trim();
  if (input.hostInitials != null) data.hostInitials = input.hostInitials;
  if (input.hostRole != null) data.hostRole = input.hostRole;

  return prisma.liveSession.update({
    where: { id },
    data,
    include: sessionInclude,
  });
}

export async function setLiveSessionStatus(
  id: string,
  status: LiveSessionStatus,
  extra?: { hmsRoomId?: string }
) {
  const now = new Date();
  return prisma.liveSession.update({
    where: { id },
    data: {
      status,
      ...(status === "LIVE" ? { wentLiveAt: now, endedAt: null } : {}),
      ...(status === "ENDED" || status === "CANCELLED" ? { endedAt: now } : {}),
      ...(extra?.hmsRoomId ? { hmsRoomId: extra.hmsRoomId } : {}),
    },
    include: sessionInclude,
  });
}

export async function registerForLiveSession(liveSessionId: string, userId: string) {
  return prisma.liveSessionRegistration.upsert({
    where: { liveSessionId_userId: { liveSessionId, userId } },
    create: { liveSessionId, userId },
    update: {},
  });
}

export async function markLiveSessionJoined(liveSessionId: string, userId: string) {
  return prisma.liveSessionRegistration.upsert({
    where: { liveSessionId_userId: { liveSessionId, userId } },
    create: { liveSessionId, userId, joinedAt: new Date() },
    update: { joinedAt: new Date() },
  });
}

export async function getUserRegistrationMap(userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, boolean>();
  const rows = await prisma.liveSessionRegistration.findMany({
    where: { userId, liveSessionId: { in: sessionIds } },
    select: { liveSessionId: true },
  });
  return new Map(rows.map((r) => [r.liveSessionId, true]));
}

export async function getAdminLiveOverview(): Promise<AdminLiveOverview> {
  const [liveNowCount, scheduledCount, totalRegistrations] = await Promise.all([
    prisma.liveSession.count({ where: { status: "LIVE" } }),
    prisma.liveSession.count({ where: { status: "SCHEDULED" } }),
    prisma.liveSessionRegistration.count(),
  ]);

  return {
    liveNowCount,
    scheduledCount,
    totalRegistrations,
    activeAttendees: 0,
  };
}

export async function listSessionRegistrations(liveSessionId: string) {
  return prisma.liveSessionRegistration.findMany({
    where: { liveSessionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
