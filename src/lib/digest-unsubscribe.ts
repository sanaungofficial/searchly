import { createHmac, timingSafeEqual } from "crypto";
import { resolveAppUrl } from "@/lib/site-host";

function digestSecret(): string {
  return (
    process.env.DIGEST_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "kimchi-digest-dev-only"
  );
}

/** Signed token for one-click digest unsubscribe links in email. */
export function signDigestUnsubscribeToken(userId: string): string {
  const sig = createHmac("sha256", digestSecret()).update(userId).digest("base64url");
  return `${userId}.${sig}`;
}

export function verifyDigestUnsubscribeToken(token: string): string | null {
  const trimmed = token.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return null;

  const userId = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!userId || !sig) return null;

  const expected = createHmac("sha256", digestSecret()).update(userId).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return userId;
}

export function digestUnsubscribeUrl(userId: string): string {
  const base = resolveAppUrl();
  const token = signDigestUnsubscribeToken(userId);
  return `${base}/api/email/digest-unsubscribe?token=${encodeURIComponent(token)}`;
}
