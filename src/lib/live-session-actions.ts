import { prisma } from "@/lib/prisma";
import {
  endLiveRoom,
  getLiveRoomStatus,
  prepareLiveRoom,
  snapshotLiveRoomMetrics,
  startHlsLiveStream,
  startLiveRecording,
  stopHlsLiveStream,
  stopLiveRecording,
} from "@/lib/hms";
import { notifyCoachFollowersLive } from "@/lib/live-session-emails";
import { logLiveSessionEvent } from "@/lib/live-session-events";
import type { LiveSessionRecord } from "@/lib/live-session-db";
import { setLiveSessionStatus } from "@/lib/live-session-db";
import { notifyLiveSessionLiveNow } from "@/lib/live-session-cron";

export async function goLiveSession(session: LiveSessionRecord) {
  const roomId = await prepareLiveRoom(session);
  const recordingId = await startLiveRecording(session);
  const hls =
    session.format === "BROADCAST"
      ? await startHlsLiveStream(session)
      : { streamId: null, playbackUrl: null };

  const updated = await setLiveSessionStatus(session.id, "LIVE", {
    hmsRoomId: roomId,
  });

  await prisma.liveSession.update({
    where: { id: session.id },
    data: {
      ...(recordingId ? { hmsRecordingId: recordingId } : {}),
      ...(hls.streamId ? { hmsLiveStreamId: hls.streamId } : {}),
      ...(hls.playbackUrl ? { hlsPlaybackUrl: hls.playbackUrl } : {}),
    },
  });

  await logLiveSessionEvent({
    liveSessionId: session.id,
    type: "SESSION_STARTED",
    metadata: { roomId, recordingId, hlsStreamId: hls.streamId },
  });

  if (recordingId) {
    await logLiveSessionEvent({
      liveSessionId: session.id,
      type: "RECORDING_STARTED",
      metadata: { recordingId },
    });
  }

  const room = await getLiveRoomStatus(session);
  void notifyLiveSessionLiveNow(session.id).catch((err) => {
    console.error("[live/go-live notify]", err);
  });
  void notifyCoachFollowersLive(session.id).catch((err) => {
    console.error("[live/follower notify]", err);
  });
  void snapshotLiveRoomMetrics(session).catch(() => {});

  return { session: updated, roomId, room };
}

export async function endLiveSession(session: LiveSessionRecord, lock = true) {
  await stopLiveRecording(session);
  if (session.hmsRoomId) {
    await stopHlsLiveStream(session.hmsRoomId);
  }
  await endLiveRoom(session, lock);
  const updated = await setLiveSessionStatus(session.id, "ENDED");

  await logLiveSessionEvent({
    liveSessionId: session.id,
    type: "SESSION_ENDED",
  });

  const room = await getLiveRoomStatus(session);
  return { session: updated, room };
}

export async function enableLiveRoomOnly(session: LiveSessionRecord) {
  const roomId = await prepareLiveRoom(session);
  const room = await getLiveRoomStatus(session);
  return { roomId, room };
}

export async function disableLiveRoomOnly(session: LiveSessionRecord) {
  await endLiveRoom(session, true);
  const room = await getLiveRoomStatus(session);
  return { room };
}

export async function markUserJoinedLive(
  liveSessionId: string,
  userId: string,
): Promise<void> {
  await logLiveSessionEvent({
    liveSessionId,
    userId,
    type: "JOINED",
  });

  const session = await prisma.liveSession.findUnique({ where: { id: liveSessionId } });
  if (session) {
    await snapshotLiveRoomMetrics(session);
    await prisma.liveSession.update({
      where: { id: liveSessionId },
      data: { totalUniqueJoins: { increment: 1 } },
    });
  }
}
