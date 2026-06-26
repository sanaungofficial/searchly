import { isSmsLive, smsAllowlist } from "@/lib/comms/sms-allowlist";
import { sendSms, smsConfigured } from "@/lib/comms/send-sms";

export function smsAdminStatus() {
  const allowlist = [...smsAllowlist()];
  return {
    plivoConfigured: smsConfigured(),
    authIdConfigured: Boolean(process.env.PLIVO_AUTH_ID),
    authTokenConfigured: Boolean(process.env.PLIVO_AUTH_TOKEN),
    sourceNumberConfigured: Boolean(process.env.PLIVO_SOURCE_NUMBER),
    liveMode: isSmsLive(),
    allowlist,
    automatedSendingEnabled: isSmsLive() || allowlist.length > 0,
    provider: "plivo" as const,
  };
}

export async function sendSmsAdminTest(input: { to: string; body?: string }) {
  const body = input.body?.trim() || "Kimchi SMS test — Plivo is connected.";
  return sendSms({
    to: input.to,
    body,
    template: "admin_test",
    bypassGate: true,
  });
}
