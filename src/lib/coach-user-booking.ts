import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type UserCoachBookingView = {
  bookingId: string;
  startAt: string;
  endAt: string;
  status: CoachBookingStatus;
  title: string | null;
  coach: {
    id: string;
    slug: string | null;
    displayName: string;
    photoUrl: string | null;
    headline: string | null;
  };
};

const ACTIVE_STATUSES: CoachBookingStatus[] = [
  CoachBookingStatus.CONFIRMED,
  CoachBookingStatus.PENDING,
  CoachBookingStatus.RESCHEDULED,
];

/** Upcoming session first; else most recent session in the last 60 days. */
export async function findActiveCoachBookingForEmail(
  email: string,
): Promise<UserCoachBookingView | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 60);

  const baseWhere = {
    guestEmail: { equals: normalized, mode: "insensitive" as const },
    status: { in: ACTIVE_STATUSES },
    startAt: { gte: windowStart },
  };

  const include = {
    coachProfile: {
      select: {
        id: true,
        slug: true,
        displayName: true,
        photoUrl: true,
        headline: true,
      },
    },
  };

  const upcoming = await prisma.coachBooking.findFirst({
    where: { ...baseWhere, startAt: { gte: now } },
    orderBy: { startAt: "asc" },
    include,
  });

  const booking =
    upcoming ??
    (await prisma.coachBooking.findFirst({
      where: { ...baseWhere, startAt: { lt: now } },
      orderBy: { startAt: "desc" },
      include,
    }));

  if (!booking) return null;

  return {
    bookingId: booking.id,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status,
    title: booking.title,
    coach: {
      id: booking.coachProfile.id,
      slug: booking.coachProfile.slug,
      displayName: booking.coachProfile.displayName,
      photoUrl: booking.coachProfile.photoUrl,
      headline: booking.coachProfile.headline,
    },
  };
}

export function formatBookingWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
