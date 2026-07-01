/** Production app origin and host detection (kimchi.so primary; app.kimchi.so legacy). */

export const KIMCHI_PRODUCTION_ORIGIN = "https://kimchi.so";
export const KIMCHI_LEGACY_APP_ORIGIN = "https://app.kimchi.so";

/** Default workspace home for returning users (AGENTS.md: dashboard after login). */
export const APP_HOME_PATH = "/dashboard";

export type RequestOriginSource = {
  headers: Headers;
  url?: string;
  nextUrl?: { origin: string };
};

export function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").split(":")[0]?.toLowerCase() ?? "";
}

function envAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return raw || null;
}

/** Ignore dev staging URL in env when deployed to production (misconfigured Vercel var). */
function resolveEnvAppUrl(): string {
  const envUrl = envAppUrl();
  if (!envUrl) return KIMCHI_PRODUCTION_ORIGIN;
  if (process.env.VERCEL_ENV === "production" && envUrl.includes(".vercel.app")) {
    return KIMCHI_PRODUCTION_ORIGIN;
  }
  return envUrl;
}

/**
 * Live origin from the incoming request — prefer x-forwarded-host on Vercel so
 * kimchi.so auth callbacks stay on kimchi.so even when NEXT_PUBLIC_APP_URL is wrong.
 */
export function resolveRequestOrigin(req: RequestOriginSource): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.split(",")[0]?.trim();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  if (req.nextUrl?.origin) {
    return req.nextUrl.origin.replace(/\/$/, "");
  }
  if (req.url) {
    return new URL(req.url).origin;
  }
  return resolveEnvAppUrl();
}

/**
 * Canonical app URL for links, Stripe, emails, etc.
 * With a request, always prefer the live origin on known app hosts over env.
 */
export function resolveAppUrl(req?: RequestOriginSource): string {
  if (req) {
    const origin = resolveRequestOrigin(req);
    const host = normalizeHost(new URL(origin).host);
    const envUrl = envAppUrl();

    if (isKimchiProductionHost(host)) return origin;
    if (host.endsWith(".vercel.app") || host === "localhost" || host === "127.0.0.1") {
      return origin;
    }
    if (envUrl && envUrl !== origin) return origin;
    return origin;
  }
  return resolveEnvAppUrl();
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
