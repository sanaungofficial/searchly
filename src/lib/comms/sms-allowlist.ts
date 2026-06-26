/** When false (default), automated SMS sends are blocked unless allowlist is set. */
export function isSmsLive(): boolean {
  return process.env.SMS_LIVE === "true";
}

/** Comma-separated E.164 numbers allowed to receive SMS in staging/preview. */
export function smsAllowlist(): Set<string> {
  const raw = process.env.SMS_ALLOWLIST?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((n) => normalizeE164(n))
      .filter(Boolean) as string[],
  );
}

/** Whether this number may receive an automated SMS from cron/flows. Admin test bypasses this. */
export function canSendAutomatedSmsTo(phone: string): boolean {
  const normalized = normalizeE164(phone);
  if (!normalized) return false;

  const allowlist = smsAllowlist();
  if (allowlist.size > 0) return allowlist.has(normalized);

  return isSmsLive();
}

/** Best-effort E.164 normalization (US-first; extend when we add intl). */
export function normalizeE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export const SMS_FOOTER = "Reply STOP to opt out. Msg&data rates may apply.";
