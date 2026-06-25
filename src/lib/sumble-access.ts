/** Enterprise-only Sumble intelligence briefs — not tied to Pro subscription. */

export type SumbleBriefAccess = {
  allowed: boolean;
  configured: boolean;
  isAdmin: boolean;
};

function allowedEmails(): Set<string> {
  const raw = process.env.SUMBLE_BRIEF_ALLOWED_EMAILS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSumbleConfigured(): boolean {
  return !!process.env.SUMBLE_API_KEY?.trim();
}

export function canAccessSumbleBriefs(
  user: { role: string; email: string },
  realUser?: { role: string } | null,
): boolean {
  if (realUser?.role === "ADMIN" || user.role === "ADMIN") return true;
  return allowedEmails().has(user.email.trim().toLowerCase());
}

export function getSumbleBriefAccess(
  user: { role: string; email: string },
  realUser?: { role: string } | null,
): SumbleBriefAccess {
  const isAdmin = realUser?.role === "ADMIN" || user.role === "ADMIN";
  return {
    allowed: isAdmin || allowedEmails().has(user.email.trim().toLowerCase()),
    configured: isSumbleConfigured(),
    isAdmin,
  };
}
