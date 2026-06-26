export {
  sendLiveSessionRegistrationEmail,
  sendLiveSessionReminderEmail,
  sendLiveSessionLiveNowEmail,
  sendLiveSessionCancelledEmail,
  notifyCoachFollowersLive,
  notifyCoachFollowersPostSession,
} from "@/lib/comms/live-session-emails";

// Legacy post-session to registrants — superseded by coach follower post email for recap.
export async function sendLiveSessionPostSessionEmail(_params: unknown): Promise<void> {
  return;
}
