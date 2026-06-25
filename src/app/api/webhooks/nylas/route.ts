import { NextRequest, NextResponse } from "next/server";
import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getNylasConfig,
  isNylasConfigured,
  parseBookingWebhookPayload,
  verifyNylasWebhookSignature,
} from "@/lib/nylas";

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
  if (!payload.configId && !payload.grantId) return;

  const coach = await prisma.coachProfile.findFirst({
    where: {
      OR: [
        ...(payload.configId ? [{ nylasSchedulerConfigId: payload.configId }] : []),
        ...(payload.grantId ? [{ nylasGrantId: payload.grantId }] : []),
      ],
    },
    select: { id: true },
  });
  if (!coach) return;

  const status: CoachBookingStatus =
    type === "booking.cancelled"
      ? CoachBookingStatus.CANCELLED
      : type === "booking.rescheduled"
        ? CoachBookingStatus.RESCHEDULED
        : type === "booking.pending"
          ? CoachBookingStatus.PENDING
          : CoachBookingStatus.CONFIRMED;

  if (!payload.startAt || !payload.endAt) return;

  const lookup = payload.nylasBookingId
    ? { nylasBookingId: payload.nylasBookingId }
    : payload.bookingRef
      ? { nylasBookingRef: payload.bookingRef }
      : null;

  const data = {
    coachProfileId: coach.id,
    nylasBookingId: payload.nylasBookingId ?? null,
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

  if (lookup) {
    const existing = await prisma.coachBooking.findFirst({ where: lookup });
    if (existing) {
      await prisma.coachBooking.update({ where: { id: existing.id }, data });
      return;
    }
  }

  await prisma.coachBooking.create({ data });
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
  if (
    type === "booking.created" ||
    type === "booking.pending" ||
    type === "booking.rescheduled" ||
    type === "booking.cancelled"
  ) {
    const parsed = parseBookingWebhookPayload(body.data ?? {});
    await upsertBookingFromWebhook(type, parsed, body);
  }

  return NextResponse.json({ ok: true });
}
