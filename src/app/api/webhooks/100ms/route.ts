import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logLiveSessionEvent } from "@/lib/live-session-events";

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.HMS_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return process.env.NODE_ENV !== "production";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hms-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    data?: Record<string, unknown>;
    room_id?: string;
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type ?? "";
  const roomId =
    (payload.room_id as string | undefined) ??
    (payload.data?.room_id as string | undefined);

  if (!roomId) {
    return NextResponse.json({ ok: true, skipped: "no room_id" });
  }

  const session = await prisma.liveSession.findFirst({
    where: { hmsRoomId: roomId },
  });

  if (!session) {
    return NextResponse.json({ ok: true, skipped: "session not found" });
  }

  const metadata = { eventType, roomId, data: payload.data ?? {} };

  if (eventType.includes("peer.join") || eventType.includes("peer.joined")) {
    await logLiveSessionEvent({
      liveSessionId: session.id,
      type: "JOINED",
      metadata,
    });
  } else if (eventType.includes("peer.leave") || eventType.includes("peer.left")) {
    await logLiveSessionEvent({
      liveSessionId: session.id,
      type: "LEFT",
      metadata,
    });
  } else if (
    eventType.includes("recording.success") ||
    eventType.includes("beam.recording.success") ||
    eventType.includes("hls.recording.success")
  ) {
    const recordingUrl =
      (payload.data?.recording_presigned_url as string | undefined) ??
      (payload.data?.url as string | undefined) ??
      null;

    if (recordingUrl) {
      await prisma.liveSession.update({
        where: { id: session.id },
        data: {
          recordingUrl,
          recordingReadyAt: new Date(),
        },
      });
      await logLiveSessionEvent({
        liveSessionId: session.id,
        type: "RECORDING_READY",
        metadata: { recordingUrl },
      });
    }
  } else if (eventType.includes("session.open.success") || eventType.includes("room.open")) {
    await logLiveSessionEvent({
      liveSessionId: session.id,
      type: "SESSION_STARTED",
      metadata,
    });
  } else if (eventType.includes("session.close") || eventType.includes("room.close")) {
    await logLiveSessionEvent({
      liveSessionId: session.id,
      type: "SESSION_ENDED",
      metadata,
    });
  }

  return NextResponse.json({ ok: true });
}
