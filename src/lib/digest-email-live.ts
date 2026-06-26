/** When false (default), the daily cron builds snapshots but does NOT email users. */
export function isDigestEmailLive(): boolean {
  return process.env.DIGEST_EMAIL_LIVE === "true";
}

/** Optional comma-separated allowlist. When set, only these addresses receive digest emails (cron + useful for staging). */
export function digestEmailAllowlist(): Set<string> {
  const raw = process.env.DIGEST_EMAIL_ALLOWLIST?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Whether this address may receive a digest email from the automated cron. */
export function canSendDigestEmailTo(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const allowlist = digestEmailAllowlist();

  if (allowlist.size > 0) {
    return allowlist.has(normalized);
  }

  return isDigestEmailLive();
}
