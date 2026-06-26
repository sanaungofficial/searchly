import {
  CoachBookingCommAudience,
  CoachBookingCommType,
  CoachBookingStatus,
  type CoachBooking,
  type CoachProfile,
  type User,
} from "@prisma/client";
import { getAssignedCoachesForUser } from "@/lib/coach-client-assignment";
import { prisma } from "@/lib/prisma";

export type CoachHubStats = {
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  uniqueClients: number;
  cancelledSessions: number;
};

export type CoachClientSummary = {
  userId: string | null;
  email: string;
  name: string | null;
  sessionCount: number;
  completedCount: number;
  upcomingCount: number;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
};

export type ClientCoachSummary = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  email: string | null;
  sessionCount: number;
  completedCount: number;
  upcomingCount: number;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  isAssigned?: boolean;
  isInternal?: boolean;
};

export type HubCommunication = {
  id: string;
  type: CoachBookingCommType | "SESSION_BOOKED" | "SESSION_RESCHEDULED" | "SESSION_CANCELLED";
  audience: CoachBookingCommAudience | "SYSTEM";
  recipientEmail: string;
  subject: string;
  bodyPreview: string | null;
  createdAt: string;
  bookingId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  coachName: string | null;
};

export type HubBooking = {
  id: string;
  coachProfileId: string;
  coachName: string;
  coachSlug: string | null;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  title: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  status: CoachBookingStatus;
  nylasBookingRef: string | null;
  durationMinutes: number;
};

const ACTIVE_STATUSES: CoachBookingStatus[] = [
  CoachBookingStatus.CONFIRMED,
  CoachBookingStatus.PENDING,
  CoachBookingStatus.RESCHEDULED,
];

export async function resolveGuestUserId(guestEmail: string | null | undefined): Promise<string | null> {
  const email = guestEmail?.trim();
  if (!email) return null;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function linkBookingUserId(bookingId: string) {
  const booking = await prisma.coachBooking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestEmail: true, userId: true },
  });
  if (!booking || booking.userId) return booking?.userId ?? null;
  const userId = await resolveGuestUserId(booking.guestEmail);
  if (!userId) return null;
  await prisma.coachBooking.update({ where: { id: bookingId }, data: { userId } });
  return userId;
}

export function bookingDurationMinutes(startAt: Date, endAt: Date) {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60_000));
}

export function mapHubBooking(
  b: CoachBooking & { coachProfile: Pick<CoachProfile, "displayName" | "slug"> },
): HubBooking {
  return {
    id: b.id,
    coachProfileId: b.coachProfileId,
    coachName: b.coachProfile.displayName,
    coachSlug: b.coachProfile.slug,
    userId: b.userId,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    title: b.title,
    location: b.location,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    nylasBookingRef: b.nylasBookingRef,
    durationMinutes: bookingDurationMinutes(b.startAt, b.endAt),
  };
}

export async function getCoachHubStats(coachProfileId: string): Promise<CoachHubStats> {
  const now = new Date();
  const bookings = await prisma.coachBooking.findMany({
    where: { coachProfileId },
    select: { guestEmail: true, startAt: true, status: true },
  });

  const guestEmails = new Set(
    bookings.map((b) => b.guestEmail?.trim().toLowerCase()).filter(Boolean) as string[],
  );

  return {
    totalSessions: bookings.length,
    completedSessions: bookings.filter(
      (b) => b.startAt < now && ACTIVE_STATUSES.includes(b.status),
    ).length,
    upcomingSessions: bookings.filter(
      (b) => b.startAt >= now && ACTIVE_STATUSES.includes(b.status),
    ).length,
    uniqueClients: guestEmails.size,
    cancelledSessions: bookings.filter((b) => b.status === CoachBookingStatus.CANCELLED).length,
  };
}

function aggregateClientRows(
  bookings: Array<{
    userId: string | null;
    guestEmail: string | null;
    guestName: string | null;
    startAt: Date;
    status: CoachBookingStatus;
    user?: Pick<User, "id" | "email" | "name"> | null;
  }>,
): CoachClientSummary[] {
  const now = new Date();
  const byKey = new Map<string, CoachClientSummary>();

  for (const b of bookings) {
    const email = (b.user?.email ?? b.guestEmail ?? "").trim().toLowerCase();
    if (!email) continue;
    const key = b.userId ?? email;
    const existing = byKey.get(key) ?? {
      userId: b.userId ?? b.user?.id ?? null,
      email,
      name: b.user?.name ?? b.guestName ?? null,
      sessionCount: 0,
      completedCount: 0,
      upcomingCount: 0,
      lastSessionAt: null,
      nextSessionAt: null,
    };

    existing.sessionCount += 1;
    if (b.startAt < now && ACTIVE_STATUSES.includes(b.status)) {
      existing.completedCount += 1;
      if (!existing.lastSessionAt || b.startAt > new Date(existing.lastSessionAt)) {
        existing.lastSessionAt = b.startAt.toISOString();
      }
    }
    if (b.startAt >= now && ACTIVE_STATUSES.includes(b.status)) {
      existing.upcomingCount += 1;
      if (!existing.nextSessionAt || b.startAt < new Date(existing.nextSessionAt)) {
        existing.nextSessionAt = b.startAt.toISOString();
      }
    }
    if (!existing.name && b.guestName) existing.name = b.guestName;
    byKey.set(key, existing);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const aTime = a.nextSessionAt ?? a.lastSessionAt ?? "";
    const bTime = b.nextSessionAt ?? b.lastSessionAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export async function getCoachClientSummaries(coachProfileId: string): Promise<CoachClientSummary[]> {
  const bookings = await prisma.coachBooking.findMany({
    where: { coachProfileId },
    select: {
      userId: true,
      guestEmail: true,
      guestName: true,
      startAt: true,
      status: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { startAt: "desc" },
  });
  return aggregateClientRows(bookings);
}

export async function getClientCoachSummaries(
  userId: string,
  email: string,
): Promise<ClientCoachSummary[]> {
  const bookings = await prisma.coachBooking.findMany({
    where: {
      OR: [{ userId }, { guestEmail: { equals: email, mode: "insensitive" } }],
    },
    include: {
      coachProfile: {
        select: { id: true, displayName: true, slug: true, photoUrl: true, headline: true, email: true },
      },
    },
    orderBy: { startAt: "desc" },
  });

  const now = new Date();
  const byCoach = new Map<string, ClientCoachSummary>();

  for (const b of bookings) {
    const coach = b.coachProfile;
    const existing = byCoach.get(coach.id) ?? {
      coachProfileId: coach.id,
      displayName: coach.displayName,
      slug: coach.slug,
      photoUrl: coach.photoUrl,
      headline: coach.headline,
      email: coach.email,
      sessionCount: 0,
      completedCount: 0,
      upcomingCount: 0,
      lastSessionAt: null,
      nextSessionAt: null,
    };

    existing.sessionCount += 1;
    if (b.startAt < now && ACTIVE_STATUSES.includes(b.status)) {
      existing.completedCount += 1;
      if (!existing.lastSessionAt || b.startAt > new Date(existing.lastSessionAt)) {
        existing.lastSessionAt = b.startAt.toISOString();
      }
    }
    if (b.startAt >= now && ACTIVE_STATUSES.includes(b.status)) {
      existing.upcomingCount += 1;
      if (!existing.nextSessionAt || b.startAt < new Date(existing.nextSessionAt)) {
        existing.nextSessionAt = b.startAt.toISOString();
      }
    }
    byCoach.set(coach.id, existing);
  }

  const assigned = await getAssignedCoachesForUser(userId);
  for (const a of assigned) {
    if (!byCoach.has(a.coachProfileId)) {
      byCoach.set(a.coachProfileId, {
        coachProfileId: a.coachProfileId,
        displayName: a.displayName,
        slug: a.slug,
        photoUrl: a.photoUrl,
        headline: a.headline,
        email: null,
        sessionCount: 0,
        completedCount: 0,
        upcomingCount: 0,
        lastSessionAt: null,
        nextSessionAt: null,
        isAssigned: true,
        isInternal: a.isInternal,
      });
    } else {
      const row = byCoach.get(a.coachProfileId)!;
      row.isAssigned = true;
      row.isInternal = a.isInternal;
    }
  }

  return Array.from(byCoach.values()).sort((a, b) => {
    const aTime = a.nextSessionAt ?? a.lastSessionAt ?? "";
    const bTime = b.nextSessionAt ?? b.lastSessionAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export type GuestHubGuest = {
  userId: string | null;
  email: string;
  name: string | null;
};

export type GuestHubPayload = {
  guest: GuestHubGuest;
  assignedCoaches: Array<{
    coachProfileId: string;
    displayName: string;
    slug: string | null;
    photoUrl: string | null;
    isInternal: boolean;
    assignedAt: string;
    notes: string | null;
  }>;
  coaches: ClientCoachSummary[];
  upcomingBookings: HubBooking[];
  pastBookings: HubBooking[];
  communications: HubCommunication[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    upcomingSessions: number;
    uniqueCoaches: number;
  };
};

export async function getGuestHubData(params: { userId?: string; email?: string }): Promise<GuestHubPayload | null> {
  let userId = params.userId?.trim() || null;
  let email = params.email?.trim() || null;
  let name: string | null = null;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) return null;
    email = user.email;
    name = user.name;
    userId = user.id;
  } else if (email) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, name: true },
    });
    if (user) {
      userId = user.id;
      email = user.email;
      name = user.name;
    }
  } else {
    return null;
  }

  const guestEmail = email!;
  const coaches = userId
    ? await getClientCoachSummaries(userId, guestEmail)
    : [];

  const bookingWhere = userId
    ? { OR: [{ userId }, { guestEmail: { equals: guestEmail, mode: "insensitive" as const } }] }
    : { guestEmail: { equals: guestEmail, mode: "insensitive" as const } };

  const allBookings = await prisma.coachBooking.findMany({
    where: bookingWhere,
    orderBy: { startAt: "desc" },
    include: {
      coachProfile: { select: { id: true, displayName: true, slug: true } },
    },
  });

  const now = new Date();
  const mapBooking = (b: typeof allBookings[number]): HubBooking => ({
    id: b.id,
    coachProfileId: b.coachProfileId,
    coachName: b.coachProfile.displayName,
    coachSlug: b.coachProfile.slug,
    userId: b.userId,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    title: b.title,
    location: b.location,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    nylasBookingRef: b.nylasBookingRef,
    durationMinutes: Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000),
  });

  const upcomingBookings = allBookings
    .filter((b) => b.startAt >= now && ACTIVE_STATUSES.includes(b.status))
    .map(mapBooking);
  const pastBookings = allBookings
    .filter((b) => b.startAt < now || !ACTIVE_STATUSES.includes(b.status))
    .map(mapBooking);

  const coachProfileIds = [...new Set(allBookings.map((b) => b.coachProfileId))];
  const communications = coachProfileIds.length
    ? (
        await Promise.all(
          coachProfileIds.map((coachProfileId) =>
            getCoachHubCommunications({
              coachProfileId,
              clientUserId: userId ?? undefined,
              clientEmail: guestEmail,
              limit: 20,
            }),
          ),
        )
      ).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const assignedCoaches = userId ? await getAssignedCoachesForUser(userId) : [];

  const completedSessions = allBookings.filter(
    (b) => b.startAt < now && ACTIVE_STATUSES.includes(b.status),
  ).length;
  const upcomingSessions = allBookings.filter(
    (b) => b.startAt >= now && ACTIVE_STATUSES.includes(b.status),
  ).length;

  return {
    guest: { userId, email: guestEmail, name },
    assignedCoaches: assignedCoaches.map((a) => ({
      coachProfileId: a.coachProfileId,
      displayName: a.displayName,
      slug: a.slug,
      photoUrl: a.photoUrl,
      isInternal: a.isInternal,
      assignedAt: a.assignedAt,
      notes: a.notes,
    })),
    coaches,
    upcomingBookings,
    pastBookings,
    communications: communications.slice(0, 40),
    stats: {
      totalSessions: allBookings.length,
      completedSessions,
      upcomingSessions,
      uniqueCoaches: coachProfileIds.length,
    },
  };
}

function syntheticCommFromBooking(
  b: CoachBooking & {
    coachProfile: Pick<CoachProfile, "displayName">;
  },
): HubCommunication[] {
  const guest = b.guestName ?? b.guestEmail ?? "Client";
  const coach = b.coachProfile.displayName;
  const when = b.startAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const rows: HubCommunication[] = [
    {
      id: `booking-created-${b.id}`,
      type: "SESSION_BOOKED",
      audience: "SYSTEM",
      recipientEmail: b.guestEmail ?? "",
      subject: `Session booked with ${coach}`,
      bodyPreview: `${guest} booked a coaching session for ${when}.`,
      createdAt: b.createdAt.toISOString(),
      bookingId: b.id,
      clientName: b.guestName,
      clientEmail: b.guestEmail,
      coachName: coach,
    },
  ];

  if (b.status === CoachBookingStatus.RESCHEDULED) {
    rows.push({
      id: `booking-rescheduled-${b.id}`,
      type: "SESSION_RESCHEDULED",
      audience: "SYSTEM",
      recipientEmail: b.guestEmail ?? "",
      subject: `Session rescheduled with ${coach}`,
      bodyPreview: `Session moved to ${when}.`,
      createdAt: b.updatedAt.toISOString(),
      bookingId: b.id,
      clientName: b.guestName,
      clientEmail: b.guestEmail,
      coachName: coach,
    });
  }

  if (b.status === CoachBookingStatus.CANCELLED) {
    rows.push({
      id: `booking-cancelled-${b.id}`,
      type: "SESSION_CANCELLED",
      audience: "SYSTEM",
      recipientEmail: b.guestEmail ?? "",
      subject: `Session cancelled with ${coach}`,
      bodyPreview: `Session on ${when} was cancelled.`,
      createdAt: b.updatedAt.toISOString(),
      bookingId: b.id,
      clientName: b.guestName,
      clientEmail: b.guestEmail,
      coachName: coach,
    });
  }

  return rows;
}

export async function getCoachHubCommunications(params: {
  coachProfileId: string;
  clientUserId?: string;
  clientEmail?: string;
  limit?: number;
}): Promise<HubCommunication[]> {
  const limit = params.limit ?? 50;

  const stored = await prisma.coachBookingCommunication.findMany({
    where: {
      coachProfileId: params.coachProfileId,
      ...(params.clientUserId ? { clientUserId: params.clientUserId } : {}),
      ...(params.clientEmail && !params.clientUserId
        ? { recipientEmail: { equals: params.clientEmail, mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      booking: { select: { guestName: true, guestEmail: true } },
      coachProfile: { select: { displayName: true } },
    },
  });

  const bookingWhere = {
    coachProfileId: params.coachProfileId,
    ...(params.clientUserId
      ? { userId: params.clientUserId }
      : params.clientEmail
        ? { guestEmail: { equals: params.clientEmail, mode: "insensitive" } }
        : {}),
  };

  const bookings = await prisma.coachBooking.findMany({
    where: bookingWhere,
    include: { coachProfile: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const synthetic = bookings.flatMap(syntheticCommFromBooking);

  const mappedStored: HubCommunication[] = stored.map((c) => ({
    id: c.id,
    type: c.type,
    audience: c.audience,
    recipientEmail: c.recipientEmail,
    subject: c.subject,
    bodyPreview: c.bodyPreview,
    createdAt: c.createdAt.toISOString(),
    bookingId: c.bookingId,
    clientName: c.booking?.guestName ?? null,
    clientEmail: c.booking?.guestEmail ?? null,
    coachName: c.coachProfile.displayName,
  }));

  const merged = [...mappedStored, ...synthetic]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  const seen = new Set<string>();
  return merged.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function getCoachHubBookings(params: {
  coachProfileId: string;
  clientUserId?: string;
  clientEmail?: string;
  upcoming?: boolean;
  limit?: number;
}): Promise<HubBooking[]> {
  const now = new Date();
  const limit = params.limit ?? 30;

  const bookings = await prisma.coachBooking.findMany({
    where: {
      coachProfileId: params.coachProfileId,
      ...(params.clientUserId
        ? { userId: params.clientUserId }
        : params.clientEmail
          ? { guestEmail: { equals: params.clientEmail, mode: "insensitive" } }
          : {}),
      ...(params.upcoming === true
        ? { startAt: { gte: now }, status: { in: ACTIVE_STATUSES } }
        : params.upcoming === false
          ? { startAt: { lt: now } }
          : {}),
    },
    orderBy: { startAt: params.upcoming === false ? "desc" : "asc" },
    take: limit,
    include: { coachProfile: { select: { displayName: true, slug: true } } },
  });

  return bookings.map(mapHubBooking);
}

export async function getCoachProfileForUser(userId: string, role: string) {
  if (role === "ADMIN") return null;
  return prisma.coachProfile.findFirst({
    where: { userId },
    select: { id: true, displayName: true, slug: true, email: true, photoUrl: true, headline: true, nylasGrantId: true, status: true },
  });
}
