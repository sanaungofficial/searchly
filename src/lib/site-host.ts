/** Production app origin and host detection (kimchi.so primary; app.kimchi.so legacy). */

export const KIMCHI_PRODUCTION_ORIGIN = "https://kimchi.so";
export const KIMCHI_LEGACY_APP_ORIGIN = "https://app.kimchi.so";

export function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").split(":")[0]?.toLowerCase() ?? "";
}

/** Canonical app URL — env override, then production default. */
export function resolveAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || KIMCHI_PRODUCTION_ORIGIN;
}

export function isKimchiProductionHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "kimchi.so" || h === "app.kimchi.so";
}

/**
 * Hosts where unauthenticated users hitting protected routes go to /login
 * (not marketing `/`). Includes dev staging (.vercel.app) and local dev.
 */
export function isAppHost(host: string): boolean {
  if (isKimchiProductionHost(host)) return true;
  const h = normalizeHost(host);
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return false;
}

/** @deprecated kimchi.so is now the primary app host; kept for callers expecting marketing-only apex. */
export function isMarketingHost(host: string): boolean {
  const h = normalizeHost(host);
  if (h === "kimchi.so") return true;
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return false;
}
