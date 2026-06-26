import { NextRequest, NextResponse } from "next/server";
import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendBookingCancelledEmail,
  sendBookingCoachNotificationEmail,
  sendBookingGuestConfirmationEmail,
} from "@/lib/booking-emails";
import {
  getNylasConfig,
  isNylasConfigured,
  parseBookingWebhookPayload,
  verifyNylasWebhookSignature,
} from "@/lib/nylas";
import {
  processUserEventWebhook,
  processUserMessageWebhook,
} from "@/lib/job-email-agent";
import { resolveGuestUserId } from "@/lib/coach-hub";
import { resolveCoachNotificationEmail } from "@/lib/coach-notification-email";
import { markCoachGrantExpired } from "@/lib/coach-scheduler-sync";

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ ok: true });
}

type WebhookEnvelope = {
  type?: string;
  data?: {
    grant_id?: string;
    object?: Record<string, unknown>;
  };
};

async function upsertBookingFromWebhook(
  type: string,
  payload: ReturnType<typeof parseBookingWebhookPayload>,
  raw: unknown,
) {
  if (!payload.configId && !payload.grantId) return null;

  const coach = await prisma.coachProfile.findFirst({
    where: {
      OR: [
        ...(payload.configId
          ? [
              { nylasSchedulerConfigId: payload.configId },
              { nylasIntroSchedulerConfigId: payload.configId },
            ]
          : []),
        ...(payload.grantId ? [{ nylasGrantId: payload.grantId }] : []),
      ],
    },
    select: { id: true, displayName: true, email: true, nylasGrantEmail: true },
  });
  if (!coach) return null;

  const status: CoachBookingStatus =
    type === "booking.cancelled"
      ? CoachBookingStatus.CANCELLED
      : type === "booking.rescheduled"
        ? CoachBookingStatus.RESCHEDULED
        : type === "booking.pending"
          ? CoachBookingStatus.PENDING
          : CoachBookingStatus.CONFIRMED;

  if (!payload.startAt || !payload.endAt) return null;

  const lookup = payload.bookingId
    ? { nylasBookingId: payload.bookingId }
    : payload.bookingRef
      ? { nylasBookingRef: payload.bookingRef }
      : null;

  const userId = await resolveGuestUserId(payload.guestEmail);

  const data = {
    coachProfileId: coach.id,
    userId,
    nylasBookingId: payload.bookingId ?? null,
    nylasBookingRef: payload.bookingRef ?? null,
    nylasConfigId: payload.configId ?? null,
    nylasEventId: payload.eventId ?? null,
    guestName: payload.guestName ?? null,
    guestEmail: payload.guestEmail ?? null,
    title: payload.title ?? null,
    location: payload.location ?? null,
    startAt: payload.startAt,
    endAt: payload.endAt,
    status,
    rawPayload: raw as object,
  };

  let isNew = false;
  let bookingId: string;

  if (lookup) {
    const existing = await prisma.coachBooking.findFirst({ where: lookup });
    if (existing) {
      const updated = await prisma.coachBooking.update({ where: { id: existing.id }, data });
      bookingId = updated.id;
    } else {
      const created = await prisma.coachBooking.create({ data });
      bookingId = created.id;
      isNew = true;
    }
  } else {
    const created = await prisma.coachBooking.create({ data });
    bookingId = created.id;
    isNew = true;
  }

  return {
    isNew,
    type,
    bookingId,
    coachProfileId: coach.id,
    clientUserId: userId,
    coachName: coach.displayName,
    coachEmail: resolveCoachNotificationEmail(coach),
    guestName: payload.guestName,
    guestEmail: payload.guestEmail,
    title: payload.title,
    startAt: payload.startAt.toISOString(),
    endAt: payload.endAt.toISOString(),
    bookingRef: payload.bookingRef,
  };
}

export async function POST(req: NextRequest) {
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const cfg = getNylasConfig();

  if (cfg?.webhookSecret) {
    const signature = req.headers.get("x-nylas-signature");
    if (!verifyNylasWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: WebhookEnvelope;
  try {
    body = JSON.parse(rawBody) as WebhookEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type ?? "";
  const grantId = body.data?.grant_id;
  const objectId = body.data?.object?.id as string | undefined;

  if (type === "grant.expired" || type === "grant.deleted") {
    if (grantId) {
      const coach = await prisma.coachProfile.findFirst({
        where: { nylasGrantId: grantId },
        select: { id: true },
      });
      if (coach) {
        await markCoachGrantExpired(coach.id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (
    grantId &&
    objectId &&
    (type === "message.created" || type === "message.updated")
  ) {
    const coachGrant = await prisma.coachProfile.findFirst({
      where: { nylasGrantId: grantId, nylasEmailSyncEnabled: true },
      select: { id: true },
    });
    if (!coachGrant) {
      processUserMessageWebhook(grantId, objectId).catch((err) =>
        console.error("[nylas/webhook] user message", err),
      );
    }
  }

  if (
    grantId &&
    objectId &&
    (type === "event.created" || type === "event.updated")
  ) {
    processUserEventWebhook(grantId, objectId).catch((err) =>
      console.error("[nylas/webhook] user event", err),
    );
  }

  if (
    type === "booking.created" ||
    type === "booking.pending" ||
    type === "booking.rescheduled" ||
    type === "booking.cancelled"
  ) {
    const parsed = parseBookingWebhookPayload(body.data ?? {});
    const result = await upsertBookingFromWebhook(type, parsed, body);

    if (result?.guestEmail) {
      const emailPayload = {
        coachProfileId: result.coachProfileId,
        bookingId: result.bookingId,
        clientUserId: result.clientUserId,
        guestEmail: result.guestEmail,
        guestName: result.guestName,
        coachName: result.coachName,
        title: result.title,
        startAt: result.startAt,
        endAt: result.endAt,
        bookingRef: result.bookingRef,
      };

      if (type === "booking.cancelled") {
        sendBookingCancelledEmail(emailPayload).catch((err) => console.error("[nylas/webhook] cancel email", err));
      } else if (type === "booking.rescheduled") {
        const { sendBookingRescheduledEmail } = await import("@/lib/comms/booking-emails");
        sendBookingRescheduledEmail(emailPayload).catch((err) =>
          console.error("[nylas/webhook] reschedule email", err),
        );
      } else if (
        (type === "booking.created" || type === "booking.pending") &&
        result.isNew
      ) {
        sendBookingGuestConfirmationEmail(emailPayload).catch((err) =>
          console.error("[nylas/webhook] guest email", err),
        );
        if (result.coachEmail) {
          sendBookingCoachNotificationEmail({
            ...emailPayload,
            coachEmail: result.coachEmail,
          }).catch((err) => console.error("[nylas/webhook] coach email", err));
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
