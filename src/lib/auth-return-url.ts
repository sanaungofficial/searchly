/** Safe post-auth return paths and public coaching route helpers. */

export function sanitizeReturnPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

export function buildAuthUrl(mode: "login" | "signup", returnPath: string): string {
  const base = mode === "login" ? "/login" : "/signup";
  const safe = sanitizeReturnPath(returnPath);
  if (!safe) return base;
  return `${base}?next=${encodeURIComponent(safe)}`;
}

/** Logged-out users can browse coaches on these routes. */
export function isPublicCoachingPath(pathname: string): boolean {
  if (pathname === "/coaching") return true;
  if (pathname.startsWith("/coaching/c/")) return true;
  if (/^\/coach\/[^/]+$/.test(pathname)) return true;
  return false;
}

/** Coaching routes that always require sign-in. */
export function requiresAuthCoachingPath(pathname: string): boolean {
  if (pathname.startsWith("/coaching/my-coaches")) return true;
  if (pathname.startsWith("/coaching/reschedule/")) return true;
  if (pathname.startsWith("/coaching/cancel/")) return true;
  return false;
}

export function currentPathWithSearch(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}
