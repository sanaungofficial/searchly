import { createHmac, timingSafeEqual } from "crypto";
import type { SchedulerDayHours } from "@/lib/coach-scheduler-settings";
import { buildNylasOpenHoursBlocks } from "@/lib/coach-scheduler-settings";
import type { NextRequest, NextResponse } from "next/server";
import { isStaffPortalRole } from "@/lib/staff-portal";

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
  const path = isStaffPortalRole(role)
    ? `${base}/expert/offerings?section=profile`
    : `${base}/admin/profile`;
  if (!params || Object.keys(params).length === 0) return path;

  const qs = new URLSearchParams(params).toString();
  return qs ? `${path}?${qs}` : path;
}

/** Where job seekers land after connecting a dedicated job-search inbox. */
export function nylasUserInboxReturnUrl(appUrl: string, params?: Record<string, string>, returnPath = "/profile/preferences"): string {
  const pathPart = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  const [pathname, existingQuery = ""] = pathPart.split("?");
  const merged = new URLSearchParams(existingQuery);
  if (params) {
    for (const [key, value] of Object.entries(params)) merged.set(key, value);
  }
  const qs = merged.toString();
  return `${appUrl.replace(/\/$/, "")}${pathname}${qs ? `?${qs}` : ""}`;
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

const MICROSOFT_EMAIL_SUFFIXES = [
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "office365.com",
  "outlook.co.uk",
];

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function emailDomainLooksMicrosoft(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return (
    MICROSOFT_EMAIL_SUFFIXES.includes(domain) ||
    domain.includes("onmicrosoft.com") ||
    domain.endsWith(".onmicrosoft.com")
  );
}

/** Skip login_hint when it would steer Nylas to the wrong provider (e.g. Gmail hint on Outlook connect). */
export function loginHintForNylasProvider(
  email: string | undefined,
  provider: "google" | "microsoft",
): string | undefined {
  if (!email?.trim()) return undefined;
  const domain = emailDomain(email);
  if (!domain) return undefined;

  if (provider === "google") {
    if (domain === "gmail.com" || domain === "googlemail.com" || domain.endsWith(".edu")) {
      return email.trim();
    }
    // Custom Google Workspace domains are common — still pass hint for Google button.
    if (!MICROSOFT_EMAIL_SUFFIXES.includes(domain) && !domain.includes("onmicrosoft.com")) {
      return email.trim();
    }
    return undefined;
  }

  if (
    MICROSOFT_EMAIL_SUFFIXES.includes(domain) ||
    domain.includes("onmicrosoft.com") ||
    domain.endsWith(".onmicrosoft.com")
  ) {
    return email.trim();
  }
  return undefined;
}

/** Build the documented GET /v3/connect/auth URL (browser redirect). */
export function buildNylasAuthUrl(params: {
  provider: "google" | "microsoft";
  state: string;
  loginHint?: string;
  /** When set, request inbox + calendar read scopes for job-search agent. */
  inboxAccess?: boolean;
  /** When set, request mail read/send scopes for coach email sync. */
  emailSync?: boolean;
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
  });

  const loginHint = loginHintForNylasProvider(params.loginHint, params.provider);
  if (loginHint) query.set("login_hint", loginHint);

  if (params.inboxAccess || params.emailSync) {
    const scope =
      params.provider === "microsoft"
        ? "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/Contacts.Read"
        : [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/contacts.readonly",
          ].join(" ");
    query.set("scope", scope);
  } else if (params.provider === "microsoft") {
    query.set("scope", "https://graph.microsoft.com/Calendars.ReadWrite");
  } else {
    query.set("scope", [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" "));
  }

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

type NylasGrantResponse = {
  data?: { email?: string; grant_id?: string };
  email?: string;
};

/** Email on the connected calendar grant — must match scheduler participant email. */
export async function getNylasGrantEmail(grantId: string): Promise<string | null> {
  try {
    const res = await nylasFetch<NylasGrantResponse>(`/v3/grants/${grantId}`);
    return res.data?.email?.trim() || res.email?.trim() || null;
  } catch (err) {
    console.error("[nylas] get grant email", err);
    return null;
  }
}

export type NylasSchedulerConfig = {
  id?: string;
  ID?: string;
  slug?: string;
};

export type NylasCalendar = {
  id: string;
  name?: string;
  is_primary?: boolean;
  read_only?: boolean;
};

export async function listCalendars(grantId: string): Promise<NylasCalendar[]> {
  const res = await nylasFetch<{ data?: NylasCalendar[] }>(`/v3/grants/${grantId}/calendars?limit=100`, {
    grantId,
  });
  return res.data ?? [];
}

export async function revokeNylasGrant(grantId: string): Promise<void> {
  await nylasFetch(`/v3/grants/${grantId}`, { method: "DELETE", grantId });
}

export type CoachSchedulerParams = {
  grantId: string;
  coachName: string;
  coachEmail: string;
  slug: string;
  durationMinutes?: number;
  timezone?: string;
  openHourStart?: string;
  openHourEnd?: string;
  openDays?: number[];
  weeklyHours?: SchedulerDayHours[];
  bufferMinutes?: number;
  minBookingNoticeMinutes?: number;
  availabilityNotes?: string | null;
  blackoutDates?: string[];
  calendarIds?: string[];
  bookingCalendarId?: string;
  conferenceProvider?: "google_meet" | "microsoft_teams" | null;
  sessionLabel?: "intro" | "session";
};

function schedulerConfigBody(params: CoachSchedulerParams) {
  const appBase = nylasOAuthAppUrl();
  const duration = params.durationMinutes ?? 30;
  const timezone = params.timezone ?? "America/New_York";
  const calendarIds = params.calendarIds?.length ? params.calendarIds : ["primary"];
  const bookingCalendarId = params.bookingCalendarId ?? calendarIds[0] ?? "primary";
  const weekly =
    params.weeklyHours ??
    (params.openDays
      ? [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          enabled: (params.openDays ?? []).includes(day),
          start: params.openHourStart ?? "09:00",
          end: params.openHourEnd ?? "17:00",
        }))
      : []);
  const blackoutDates = params.blackoutDates ?? [];
  const openHoursBlocks = buildNylasOpenHoursBlocks(weekly, timezone, blackoutDates);
  const bufferMinutes = params.bufferMinutes ?? 0;
  const sessionKind = params.sessionLabel === "intro" ? "intro call" : "coaching session";
  const descriptionParts = [`Book a 1:1 ${sessionKind} via Kimchi.`];
  if (params.availabilityNotes) descriptionParts.push(params.availabilityNotes);

  const eventTitle =
    params.sessionLabel === "intro"
      ? `Intro call with ${params.coachName}`
      : `Coaching session with ${params.coachName}`;

  const conferencing =
    params.conferenceProvider === "google_meet"
      ? { autocreate: { provider: "Google Meet" } }
      : params.conferenceProvider === "microsoft_teams"
        ? { autocreate: { provider: "Microsoft Teams" } }
        : undefined;

  return {
    requires_session_auth: false,
    slug: params.slug,
    participants: [
      {
        name: params.coachName,
        email: params.coachEmail,
        grant_id: params.grantId,
        is_organizer: true,
        timezone,
        availability: { calendar_ids: calendarIds },
        booking: { calendar_id: bookingCalendarId },
      },
    ],
    availability: {
      duration_minutes: duration,
      availability_rules: {
        default_open_hours: openHoursBlocks,
        ...(bufferMinutes > 0
          ? { buffer: { before: 0, after: bufferMinutes } }
          : {}),
      },
    },
    event_booking: {
      title: eventTitle,
      description: descriptionParts.join("\n\n"),
      timezone,
      ...(conferencing ? { conferencing } : {}),
    },
    scheduler: {
      rescheduling_url: `${appBase}/coaching/reschedule/:booking_ref`,
      cancellation_url: `${appBase}/coaching/cancel/:booking_ref`,
      min_booking_notice: params.minBookingNoticeMinutes ?? 1440,
      available_days_in_future: 60,
    },
  };
}

export async function createCoachSchedulerConfig(
  params: CoachSchedulerParams,
): Promise<{ configId: string; slug?: string }> {
  const res = await nylasFetch<{ data?: NylasSchedulerConfig } & NylasSchedulerConfig>(
    `/v3/grants/${params.grantId}/scheduling/configurations`,
    {
      method: "POST",
      grantId: params.grantId,
      body: schedulerConfigBody(params),
    },
  );

  const data = (res as { data?: NylasSchedulerConfig }).data ?? res;
  const configId = data.id ?? data.ID;
  if (!configId) throw new Error("Nylas did not return scheduler configuration id");
  return { configId, slug: data.slug ?? params.slug };
}

export async function updateCoachSchedulerConfig(
  params: CoachSchedulerParams & { configId: string },
): Promise<void> {
  await nylasFetch(`/v3/grants/${params.grantId}/scheduling/configurations/${params.configId}`, {
    method: "PUT",
    grantId: params.grantId,
    body: schedulerConfigBody(params),
  });
}

/** Create scheduler when grant exists but configId is missing (OAuth ok, setup failed). */
export async function ensureCoachSchedulerConfig(params: CoachSchedulerParams & {
  configId: string | null;
}): Promise<{ configId: string; slug?: string; created: boolean }> {
  if (params.configId) {
    await updateCoachSchedulerConfig({
      grantId: params.grantId,
      configId: params.configId,
      coachName: params.coachName,
      coachEmail: params.coachEmail,
      slug: params.slug,
      durationMinutes: params.durationMinutes,
      timezone: params.timezone,
      openHourStart: params.openHourStart,
      openHourEnd: params.openHourEnd,
      openDays: params.openDays,
      weeklyHours: params.weeklyHours,
      bufferMinutes: params.bufferMinutes,
      minBookingNoticeMinutes: params.minBookingNoticeMinutes,
      availabilityNotes: params.availabilityNotes,
      blackoutDates: params.blackoutDates,
      calendarIds: params.calendarIds,
      bookingCalendarId: params.bookingCalendarId,
      conferenceProvider: params.conferenceProvider,
      sessionLabel: params.sessionLabel,
    });
    return { configId: params.configId, created: false };
  }

  const created = await createCoachSchedulerConfig({
    grantId: params.grantId,
    coachName: params.coachName,
    coachEmail: params.coachEmail,
    slug: params.slug,
    durationMinutes: params.durationMinutes,
    timezone: params.timezone,
    openHourStart: params.openHourStart,
    openHourEnd: params.openHourEnd,
    openDays: params.openDays,
    weeklyHours: params.weeklyHours,
    bufferMinutes: params.bufferMinutes,
    minBookingNoticeMinutes: params.minBookingNoticeMinutes,
    availabilityNotes: params.availabilityNotes,
    blackoutDates: params.blackoutDates,
    calendarIds: params.calendarIds,
    bookingCalendarId: params.bookingCalendarId,
    conferenceProvider: params.conferenceProvider,
    sessionLabel: params.sessionLabel,
  });
  return { ...created, created: true };
}

export type NylasOAuthStatePayload =
  | { kind: "coach"; coachProfileId: string; ts: number; returnAppUrl?: string; returnPath?: string; emailSync?: boolean }
  | { kind: "user"; userId: string; ts: number; returnAppUrl?: string; returnPath?: string };

export type NylasOAuthState = { coachProfileId: string; ts: number; returnAppUrl?: string };

export function signNylasOAuthState(payload: NylasOAuthStatePayload): string {
  const cfg = getNylasConfig();
  if (!cfg) throw new Error("Nylas is not configured");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", cfg.apiKey).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyNylasOAuthState(state: string): NylasOAuthStatePayload | null {
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
      kind?: "coach" | "user";
      coachProfileId?: string;
      userId?: string;
      ts?: number;
      returnAppUrl?: string;
      returnPath?: string;
      emailSync?: boolean;
    };
    if (!parsed.ts || Date.now() - parsed.ts > 1000 * 60 * 60) return null;

    if (parsed.kind === "user" && parsed.userId) {
      return {
        kind: "user",
        userId: parsed.userId,
        ts: parsed.ts,
        ...(parsed.returnAppUrl ? { returnAppUrl: parsed.returnAppUrl } : {}),
      };
    }

    if (parsed.coachProfileId) {
      return {
        kind: "coach",
        coachProfileId: parsed.coachProfileId,
        ts: parsed.ts,
        ...(parsed.returnAppUrl ? { returnAppUrl: parsed.returnAppUrl } : {}),
        ...(parsed.returnPath ? { returnPath: parsed.returnPath } : {}),
        ...(parsed.emailSync ? { emailSync: true } : {}),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function signNylasState(payload: NylasOAuthState): string {
  return signNylasOAuthState({ kind: "coach", ...payload });
}

export function verifyNylasState(state: string): NylasOAuthState | null {
  const parsed = verifyNylasOAuthState(state);
  if (!parsed || parsed.kind !== "coach") return null;
  return {
    coachProfileId: parsed.coachProfileId,
    ts: parsed.ts,
    ...(parsed.returnAppUrl ? { returnAppUrl: parsed.returnAppUrl } : {}),
  };
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
  payload: NylasOAuthStatePayload,
): NextResponse {
  response.cookies.set(NYLAS_OAUTH_COOKIE, signNylasOAuthState(payload), nylasOAuthCookieOptions());
  return response;
}

export function readNylasOAuthCookie(req: NextRequest): NylasOAuthStatePayload | null {
  const raw = req.cookies.get(NYLAS_OAUTH_COOKIE)?.value;
  if (!raw) return null;
  return verifyNylasOAuthState(raw);
}

export function clearNylasOAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(NYLAS_OAUTH_COOKIE, "", { ...nylasOAuthCookieOptions(), maxAge: 0 });
  return response;
}

export function resolveNylasOAuthState(
  req: NextRequest,
  stateFromQuery: string | null,
): NylasOAuthStatePayload | null {
  return verifyNylasOAuthState(stateFromQuery ?? "") ?? readNylasOAuthCookie(req);
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

export type NylasTimeSlot = { start_time: number; end_time: number };

type NylasAvailabilityResponse = {
  data?: { time_slots?: NylasTimeSlot[] };
  time_slots?: NylasTimeSlot[];
};

/** List bookable slots for a scheduler configuration (Kimchi booking UI). */
export async function getSchedulerAvailability(params: {
  configurationId: string;
  startTime: number;
  endTime: number;
}): Promise<NylasTimeSlot[]> {
  const query = new URLSearchParams({
    configuration_id: params.configurationId,
    start_time: String(params.startTime),
    end_time: String(params.endTime),
  });

  const res = await nylasFetch<NylasAvailabilityResponse>(`/v3/scheduling/availability?${query.toString()}`);
  const slots = res.data?.time_slots ?? res.time_slots ?? [];
  return slots.filter((s) => s.start_time && s.end_time);
}

export type NylasBookingCreateResponse = {
  data?: {
    booking_id?: string;
    booking_ref?: string;
    event_id?: string;
    title?: string;
  };
  booking_id?: string;
  booking_ref?: string;
  event_id?: string;
  title?: string;
};

/** Confirm a booking against a scheduler configuration. */
export async function createSchedulerBooking(params: {
  configurationId: string;
  startTime: number;
  endTime: number;
  guestName: string;
  guestEmail: string;
  timezone?: string;
}): Promise<{
  bookingId?: string;
  bookingRef?: string;
  eventId?: string;
  title?: string;
}> {
  const query = new URLSearchParams({ configuration_id: params.configurationId });
  const res = await nylasFetch<NylasBookingCreateResponse>(`/v3/scheduling/bookings?${query.toString()}`, {
    method: "POST",
    body: {
      start_time: params.startTime,
      end_time: params.endTime,
      guest: { name: params.guestName, email: params.guestEmail },
      ...(params.timezone ? { timezone: params.timezone } : {}),
    },
  });

  const data = res.data ?? res;
  return {
    bookingId: data.booking_id,
    bookingRef: data.booking_ref,
    eventId: data.event_id,
    title: data.title,
  };
}

/** Cancel a scheduler booking via Nylas API. */
export async function cancelSchedulerBooking(params: {
  bookingId: string;
  configurationId: string;
  cancellationReason?: string;
}): Promise<void> {
  const query = new URLSearchParams({ configuration_id: params.configurationId });
  await nylasFetch(`/v3/scheduling/bookings/${params.bookingId}?${query.toString()}`, {
    method: "DELETE",
    body: params.cancellationReason ? { cancellation_reason: params.cancellationReason } : undefined,
  });
}

/** Reschedule a scheduler booking via Nylas API. */
export async function rescheduleSchedulerBooking(params: {
  bookingId: string;
  configurationId: string;
  startTime: number;
  endTime: number;
}): Promise<void> {
  const query = new URLSearchParams({ configuration_id: params.configurationId });
  await nylasFetch(`/v3/scheduling/bookings/${params.bookingId}?${query.toString()}`, {
    method: "PATCH",
    body: {
      start_time: params.startTime,
      end_time: params.endTime,
    },
  });
}
