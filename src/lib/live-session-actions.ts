import type { LiveSessionRecord } from "@/lib/live-session-db";
import { setLiveSessionStatus } from "@/lib/live-session-db";
import { endLiveRoom, getLiveRoomStatus, prepareLiveRoom } from "@/lib/hms";
import { notifyLiveSessionLiveNow } from "@/lib/live-session-cron";

export async function goLiveSession(session: LiveSessionRecord) {
  const roomId = await prepareLiveRoom(session);
  const updated = await setLiveSessionStatus(session.id, "LIVE", { hmsRoomId: roomId });
  const room = await getLiveRoomStatus(session);
  void notifyLiveSessionLiveNow(session.id).catch((err) => {
    console.error("[live/go-live notify]", err);
  });
  return { session: updated, roomId, room };
}

export async function endLiveSession(session: LiveSessionRecord, lock = true) {
  await endLiveRoom(session, lock);
  const updated = await setLiveSessionStatus(session.id, "ENDED");
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
