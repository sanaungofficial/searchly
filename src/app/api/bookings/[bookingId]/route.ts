import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientCoachingUser } from "@/lib/coach-api";
import { listCoachClientSessionNotes } from "@/lib/coach-client-session-notes";
import { listCoachSharedDocumentsForClient } from "@/lib/coach-shared-documents";

type ClientExchangeNote = {
  userId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
};

type BookingRawPayload = {
  clientExchangeNotes?: ClientExchangeNote[];
  [key: string]: unknown;
};

function parseRawPayload(raw: unknown): BookingRawPayload {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as BookingRawPayload;
  }
  return {};
}

async function assertUserOwnsBooking(bookingId: string, userId: string, email: string) {
  const booking = await prisma.coachBooking.findFirst({
    where: {
      id: bookingId,
      OR: [{ userId }, { guestEmail: { equals: email, mode: "insensitive" } }],
    },
    include: {
      coachProfile: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          photoUrl: true,
        },
      },
    },
  });
  return booking;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId } = await params;
  const booking = await assertUserOwnsBooking(bookingId, me.id, me.email);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const rawPayload = parseRawPayload(booking.rawPayload);
  const allNotes = await listCoachClientSessionNotes({
    clientUserId: me.id,
    coachProfileId: booking.coachProfileId,
  });
  const sessionNotes = allNotes.filter((n) => n.coachBookingId === booking.id);

  const documents = await listCoachSharedDocumentsForClient({
    clientUserId: me.id,
    coachProfileId: booking.coachProfileId,
  });

  return NextResponse.json({
    booking: {
      id: booking.id,
      coachProfileId: booking.coachProfileId,
      coachName: booking.coachProfile.displayName,
      coachSlug: booking.coachProfile.slug,
      coachPhotoUrl: booking.coachProfile.photoUrl,
      title: booking.title,
      location: booking.location,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
      nylasBookingRef: booking.nylasBookingRef,
      durationMinutes: Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60000),
      createdAt: booking.createdAt.toISOString(),
    },
    sessionNotes,
    clientExchangeNotes: rawPayload.clientExchangeNotes ?? [],
    documents,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId } = await params;
  const booking = await assertUserOwnsBooking(bookingId, me.id, me.email);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  let body: { clientNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const noteText = body.clientNote?.trim();
  if (!noteText) {
    return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  }

  const rawPayload = parseRawPayload(booking.rawPayload);
  const existing = rawPayload.clientExchangeNotes ?? [];
  const entry: ClientExchangeNote = {
    userId: me.id,
    authorName: me.name ?? null,
    body: noteText,
    createdAt: new Date().toISOString(),
  };

  await prisma.coachBooking.update({
    where: { id: booking.id },
    data: {
      rawPayload: {
        ...rawPayload,
        clientExchangeNotes: [...existing, entry],
      },
    },
  });

  return NextResponse.json({ note: entry });
}
