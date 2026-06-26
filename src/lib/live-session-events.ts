import type { LiveSessionEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logLiveSessionEvent(args: {
  liveSessionId: string;
  type: LiveSessionEventType;
  userId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.liveSessionEvent.create({
    data: {
      liveSessionId: args.liveSessionId,
      type: args.type,
      userId: args.userId ?? null,
      metadata: args.metadata ?? undefined,
    },
  });
}

export async function getSessionAnalytics(liveSessionId: string) {
  const [session, events, registrations] = await Promise.all([
    prisma.liveSession.findUnique({
      where: { id: liveSessionId },
      include: { _count: { select: { registrations: true, events: true } } },
    }),
    prisma.liveSessionEvent.groupBy({
      by: ["type"],
      where: { liveSessionId },
      _count: { type: true },
    }),
    prisma.liveSessionRegistration.findMany({
      where: { liveSessionId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!session) return null;

  const registered = registrations.length;
  const joined = registrations.filter((r) => r.joinedAt).length;
  const conversionPct = registered > 0 ? Math.round((joined / registered) * 100) : 0;

  const eventCounts = Object.fromEntries(
    events.map((e) => [e.type, e._count.type]),
  ) as Partial<Record<LiveSessionEventType, number>>;

  return {
    sessionId: session.id,
    status: session.status,
    peakViewers: session.peakViewers,
    totalUniqueJoins: session.totalUniqueJoins,
    registered,
    joined,
    conversionPct,
    recordingUrl: session.recordingUrl,
    hlsPlaybackUrl: session.hlsPlaybackUrl,
    wentLiveAt: session.wentLiveAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    eventCounts,
    registrations: registrations.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      registeredAt: r.createdAt.toISOString(),
      joinedAt: r.joinedAt?.toISOString() ?? null,
    })),
  };
}

export async function getPlatformLiveAnalytics(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [liveNow, scheduled, totalRegistrations, recentSessions, eventTotals] = await Promise.all([
    prisma.liveSession.count({ where: { status: "LIVE" } }),
    prisma.liveSession.count({ where: { status: "SCHEDULED" } }),
    prisma.liveSessionRegistration.count(),
    prisma.liveSession.findMany({
      where: { createdAt: { gte: since } },
      include: { _count: { select: { registrations: true } } },
      orderBy: { scheduledStart: "desc" },
      take: 20,
    }),
    prisma.liveSessionEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: since } },
      _count: { type: true },
    }),
  ]);

  const totalPeak = recentSessions.reduce((sum, s) => sum + s.peakViewers, 0);
  const avgPeak =
    recentSessions.length > 0 ? Math.round(totalPeak / recentSessions.length) : 0;

  return {
    liveNow,
    scheduled,
    totalRegistrations,
    sessionsLast30Days: recentSessions.length,
    avgPeakViewers: avgPeak,
    eventTotals: Object.fromEntries(eventTotals.map((e) => [e.type, e._count.type])),
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      legacyNumericId: s.legacyNumericId,
      title: s.title,
      status: s.status,
      hostName: s.hostName,
      scheduledStart: s.scheduledStart.toISOString(),
      registrations: s._count.registrations,
      peakViewers: s.peakViewers,
    })),
  };
}
