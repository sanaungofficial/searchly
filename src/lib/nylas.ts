import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_URI = "https://api.us.nylas.com";

export const NYLAS_OAUTH_COOKIE = "nylas_oauth_state";

export type NylasConfig = {
  apiKey: string;
  clientId: string;
  apiUri: string;
  appUrl: string;
  webhookSecret?: string;
};

export function getNylasConfig(appUrlOverride?: string): NylasConfig | null {
  const apiKey = process.env.NYLAS_API_KEY?.trim();
  const clientId = process.env.NYLAS_CLIENT_ID?.trim();
  if (!apiKey || !clientId) return null;

  return {
    apiKey,
    clientId,
    apiUri: process.env.NYLAS_API_URI?.trim() || DEFAULT_API_URI,
    appUrl: appUrlOverride?.replace(/\/$/, "") || resolveKimchiAppUrl(),
    webhookSecret: process.env.NYLAS_WEBHOOK_SECRET?.trim(),
  };
}

/** Prefer the live request host so OAuth redirect URIs match Nylas dashboard (app.kimchi.so). */
export function resolveKimchiAppUrl(req?: { headers: Headers; nextUrl?: { origin: string } }): string {
  if (req) {
    const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
      .split(",")[0]
      .trim();
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
    if (req.nextUrl?.origin) return req.nextUrl.origin.replace(/\/$/, "");
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl.includes("kimchi.so")) return envUrl.replace(/\/$/, "");

  return "https://app.kimchi.so";
}

export function nylasRedirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/nylas/callback`;
}

/** Canonical host for Nylas OAuth — must match a URI registered in Nylas dashboard. */
export function nylasOAuthAppUrl(): string {
  const forced = process.env.NYLAS_OAUTH_APP_URL?.trim();
  if (forced) return forced.replace(/\/$/, "");

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl.includes("kimchi.so")) return envUrl.replace(/\/$/, "");

  return "https://app.kimchi.so";
}

export function nylasOAuthRedirectUri(): string {
  return `${nylasOAuthAppUrl()}/api/nylas/callback`;
}

export function nylasWebhookUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/nylas`;
}

/** Where coach/admin land after Nylas OAuth (profile + calendar sync). */
export function nylasProfileReturnUrl(
  appUrl: string,
  role: "ADMIN" | "COACH" | string,
  params?: Record<string, string>,
): string {
  const base = appUrl.replace(/\/$/, "");
  const path = role === "ADMIN" ? `${base}/admin/profile` : `${base}/clients?tab=profile`;
  if (!params || Object.keys(params).length === 0) return path;

  const qs = new URLSearchParams(params).toString();
  return role === "ADMIN" ? `${path}?${qs}` : `${path}&${qs}`;
}

export function isNylasConfigured(): boolean {
  return getNylasConfig() !== null;
}

type NylasFetchOptions = {
  method?: string;
  body?: unknown;
  grantId?: string;
};

export async function nylasFetch<T = unknown>(
  path: string,
  { method = "GET", body, grantId }: NylasFetchOptions = {},
): Promise<T> {
  const cfg = getNylasConfig();
  if (!cfg) throw new Error("Nylas is not configured");

  const url = `${cfg.apiUri}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...(grantId ? { "Nylas-Grant-Id": grantId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      typeof json === "object" && json && "error" in json
        ? JSON.stringify((json as { error: unknown }).error)
        : text || res.statusText;
    throw new Error(`Nylas ${method} ${path} failed (${res.status}): ${errMsg}`);
  }

  return json as T;
}

export type NylasAuthUrlResponse = {
  data?: { url?: string };
  url?: string;
};

/** Build the documented GET /v3/connect/auth URL (browser redirect). */
export function buildNylasAuthUrl(params: {
  provider: "google" | "microsoft";
  state: string;
  loginHint?: string;
}): string {
  const cfg = getNylasConfig();
  if (!cfg) throw new Error("Nylas is not configured");

  const redirectUri = nylasOAuthRedirectUri();
  const query = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    provider: params.provider,
    state: params.state,
    prompt: "detect",
  });
  if (params.loginHint) query.set("login_hint", params.loginHint);

  return `${cfg.apiUri}/v3/connect/auth?${query.toString()}`;
}

/** @deprecated Use buildNylasAuthUrl — kept for callers expecting async. */
export async function createNylasAuthUrl(params: {
  provider: "google" | "microsoft";
  state: string;
  loginHint?: string;
  appUrl?: string;
}): Promise<string> {
  return buildNylasAuthUrl(params);
}

export type NylasTokenResponse = {
  grant_id?: string;
  email?: string;
  provider?: string;
  data?: {
    grant_id?: string;
    email?: string;
    provider?: string;
  };
};

export async function exchangeNylasCode(code: string, _appUrl?: string): Promise<{ grantId: string; email?: string }> {
  const cfg = getNylasConfig();
  if (!cfg) throw new Error("Nylas is not configured");

  const res = await nylasFetch<NylasTokenResponse>("/v3/connect/token", {
    method: "POST",
    body: {
      client_id: cfg.clientId,
      client_secret: cfg.apiKey,
      code,
      redirect_uri: nylasOAuthRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: "nylas",
    },
  });

  const grantId = res.grant_id ?? res.data?.grant_id;
  if (!grantId) throw new Error("Nylas token exchange did not return grant_id");
  return { grantId, email: res.email ?? res.data?.email };
}

export type NylasSchedulerConfig = {
  id?: string;
  ID?: string;
  slug?: string;
};

export async function createCoachSchedulerConfig(params: {
  grantId: string;
  coachName: string;
  coachEmail: string;
  slug: string;
}): Promise<{ configId: string; slug?: string }> {
  const appBase = nylasOAuthAppUrl();
  const res = await nylasFetch<{ data?: NylasSchedulerConfig } & NylasSchedulerConfig>(
    `/v3/grants/${params.grantId}/scheduling/configurations`,
    {
      method: "POST",
      grantId: params.grantId,
      body: {
        requires_session_auth: false,
        slug: params.slug,
        participants: [
          {
            name: params.coachName,
            email: params.coachEmail,
            is_organizer: true,
            availability: { calendar_ids: ["primary"] },
            booking: { calendar_id: "primary" },
          },
        ],
        availability: { duration_minutes: 30 },
        event_booking: {
          title: `Coaching session with ${params.coachName}`,
          description: "Book a 1:1 coaching session via Kimchi.",
        },
        scheduler: {
          rescheduling_url: `${appBase}/coaching/reschedule/:booking_ref`,
          cancellation_url: `${appBase}/coaching/cancel/:booking_ref`,
        },
      },
    },
  );

  const data = (res as { data?: NylasSchedulerConfig }).data ?? res;
  const configId = data.id ?? data.ID;
  if (!configId) throw new Error("Nylas did not return scheduler configuration id");
  return { configId, slug: data.slug ?? params.slug };
}

export function signNylasState(payload: { coachProfileId: string; ts: number; returnAppUrl?: string }): string {
  const cfg = getNylasConfig();
  if (!cfg) throw new Error("Nylas is not configured");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", cfg.apiKey).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export type NylasOAuthState = { coachProfileId: string; ts: number; returnAppUrl?: string };

export function verifyNylasState(state: string): NylasOAuthState | null {
  const cfg = getNylasConfig();
  if (!cfg) return null;

  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", cfg.apiKey).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      coachProfileId?: string;
      ts?: number;
      returnAppUrl?: string;
    };
    if (!parsed.coachProfileId || !parsed.ts) return null;
    if (Date.now() - parsed.ts > 1000 * 60 * 60) return null;
    return {
      coachProfileId: parsed.coachProfileId,
      ts: parsed.ts,
      ...(parsed.returnAppUrl ? { returnAppUrl: parsed.returnAppUrl } : {}),
    };
  } catch {
    return null;
  }
}

function nylasOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60,
  };
}

/** Persist OAuth state in a cookie so callback still works if Nylas drops the state param. */
export function attachNylasOAuthCookie(
  response: NextResponse,
  payload: NylasOAuthState,
): NextResponse {
  response.cookies.set(NYLAS_OAUTH_COOKIE, signNylasState(payload), nylasOAuthCookieOptions());
  return response;
}

export function readNylasOAuthCookie(req: NextRequest): NylasOAuthState | null {
  const raw = req.cookies.get(NYLAS_OAUTH_COOKIE)?.value;
  if (!raw) return null;
  return verifyNylasState(raw);
}

export function clearNylasOAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(NYLAS_OAUTH_COOKIE, "", { ...nylasOAuthCookieOptions(), maxAge: 0 });
  return response;
}

export function resolveNylasOAuthState(
  req: NextRequest,
  stateFromQuery: string | null,
): NylasOAuthState | null {
  return verifyNylasState(stateFromQuery ?? "") ?? readNylasOAuthCookie(req);
}

export function mapNylasOAuthError(params: {
  error?: string | null;
  errorReason?: string | null;
  errorDescription?: string | null;
}): { reason: string; detail?: string } {
  const error = params.error?.trim();
  const errorReason = params.errorReason?.trim();
  const errorDescription = params.errorDescription?.trim();

  if (error === "access_denied") {
    return {
      reason: "denied",
      detail: errorDescription ?? "Google or Outlook access was denied.",
    };
  }

  if (errorReason === "origin_not_allowed" || error?.includes("redirect")) {
    return { reason: "redirect", detail: errorDescription };
  }

  if (errorReason === "provider_not_configured") {
    return {
      reason: "provider",
      detail: "Google is not enabled in Nylas Hosted Authentication → Identity providers.",
    };
  }

  if (error) {
    return { reason: "auth", detail: errorDescription ?? errorReason ?? error };
  }

  if (errorReason && !error) {
    return { reason: "auth", detail: errorDescription ?? errorReason };
  }

  return { reason: "auth" };
}

export function verifyNylasWebhookSignature(rawBody: string, signature: string | null): boolean {
  const cfg = getNylasConfig();
  if (!cfg?.webhookSecret || !signature) return false;

  const expected = createHmac("sha256", cfg.webhookSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function schedulerSlugForCoach(slug: string | null, coachProfileId: string): string {
  const base = (slug ?? coachProfileId).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 40);
  return `kimchi-${base}`.replace(/-+$/, "");
}

export type NylasBookingWebhookObject = {
  booking_id?: string;
  booking_ref?: string;
  configuration_id?: string;
  booking_info?: {
    event_id?: string;
    start_time?: number;
    end_time?: number;
    title?: string;
    location?: string;
    participants?: Array<{ email?: string; name?: string }>;
    additional_fields?: Record<string, string>;
  };
};

export function parseBookingWebhookPayload(data: {
  grant_id?: string;
  object?: NylasBookingWebhookObject;
}): {
  grantId?: string;
  bookingId?: string;
  bookingRef?: string;
  configId?: string;
  eventId?: string;
  startAt?: Date;
  endAt?: Date;
  title?: string;
  location?: string;
  guestName?: string;
  guestEmail?: string;
} {
  const obj = data.object;
  const info = obj?.booking_info;
  const participants = info?.participants ?? [];
  const guest = participants.find((p) => p.email && !p.email.includes("@resource.calendar"));

  return {
    grantId: data.grant_id,
    bookingId: obj?.booking_id,
    bookingRef: obj?.booking_ref,
    configId: obj?.configuration_id,
    eventId: info?.event_id,
    startAt: info?.start_time ? new Date(info.start_time * 1000) : undefined,
    endAt: info?.end_time ? new Date(info.end_time * 1000) : undefined,
    title: info?.title,
    location: info?.location,
    guestName: guest?.name,
    guestEmail: guest?.email,
  };
}
