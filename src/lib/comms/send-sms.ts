import Plivo from "plivo";
import { canSendAutomatedSmsTo, normalizeE164, SMS_FOOTER } from "@/lib/comms/sms-allowlist";

export type SmsTemplate =
  | "live_register"
  | "live_reminder"
  | "live_now"
  | "coach_shoutout"
  | "admin_test";

export type SendSmsInput = {
  to: string;
  body: string;
  template: SmsTemplate;
  /** When set, prepends coach name per Kimchi sender policy. */
  coachName?: string | null;
  /** Skip live/allowlist gate (admin test sends only). */
  bypassGate?: boolean;
  idempotencyKey?: string;
};

export type SendSmsResult = {
  sent: boolean;
  skipped?: "not_configured" | "gate" | "invalid_phone";
  messageUuid?: string;
  apiId?: string;
};

let _client: Plivo.Client | null = null;

function getPlivoClient(): Plivo.Client | null {
  const authId = process.env.PLIVO_AUTH_ID?.trim();
  const authToken = process.env.PLIVO_AUTH_TOKEN?.trim();
  if (!authId || !authToken) return null;
  if (!_client) _client = new Plivo.Client(authId, authToken);
  return _client;
}

function plivoSourceNumber(): string | null {
  const raw = process.env.PLIVO_SOURCE_NUMBER?.trim();
  if (!raw) return null;
  return normalizeE164(raw) ?? raw;
}

function formatBody(body: string, coachName?: string | null): string {
  const trimmed = body.trim();
  const prefix = coachName?.trim() ? `${coachName.trim()} via Kimchi: ` : "Kimchi: ";
  const withPrefix = trimmed.startsWith("Kimchi:") || trimmed.includes(" via Kimchi: ")
    ? trimmed
    : `${prefix}${trimmed}`;
  const footer = SMS_FOOTER;
  const combined = `${withPrefix} ${footer}`;
  // Single-segment target for US GSM (~160 chars); truncate body if needed.
  if (combined.length <= 160) return combined;
  const budget = 160 - footer.length - prefix.length - 1;
  const clipped = trimmed.slice(0, Math.max(20, budget)).trimEnd();
  return `${prefix}${clipped}… ${footer}`;
}

export function smsConfigured(): boolean {
  return Boolean(getPlivoClient() && plivoSourceNumber());
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const client = getPlivoClient();
  const src = plivoSourceNumber();
  const dst = normalizeE164(input.to);

  if (!client || !src) {
    return { sent: false, skipped: "not_configured" };
  }

  if (!dst) {
    return { sent: false, skipped: "invalid_phone" };
  }

  if (!input.bypassGate && !canSendAutomatedSmsTo(dst)) {
    return { sent: false, skipped: "gate" };
  }

  const text = formatBody(input.body, input.coachName);

  try {
    const response = await client.messages.create({
      src,
      dst,
      text,
    });

    const messageUuid = Array.isArray(response.messageUuid)
      ? response.messageUuid[0]
      : (response as { messageUuid?: string }).messageUuid;

    console.info("[comms/sms]", {
      template: input.template,
      to: dst,
      idempotencyKey: input.idempotencyKey,
      messageUuid,
      apiId: response.apiId,
    });

    return {
      sent: true,
      messageUuid: messageUuid ?? undefined,
      apiId: response.apiId,
    };
  } catch (err) {
    console.error("[comms/sms] send failed", { template: input.template, to: dst, err });
    return { sent: false };
  }
}
