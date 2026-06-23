import { getBaseUrl } from "./config";
import { clearAuthCache, getAuthCache, getSettings, setAuthCache } from "./storage";
import type { AuthState, KimchiEnv } from "./types";

function pickCookie(existing: chrome.cookies.Cookie, next: chrome.cookies.Cookie): chrome.cookies.Cookie {
  if (existing.path === "/" && next.path !== "/") return existing;
  if (next.path === "/" && existing.path !== "/") return next;
  return next.value.length > existing.value.length ? next : existing;
}

async function collectKimchiCookies(env: KimchiEnv): Promise<chrome.cookies.Cookie[]> {
  const baseUrl = getBaseUrl(env);
  const hostname = new URL(baseUrl).hostname;

  const batches = await Promise.all([
    chrome.cookies.getAll({ url: baseUrl }),
    chrome.cookies.getAll({ url: `${baseUrl}/` }),
    chrome.cookies.getAll({ domain: hostname }),
    chrome.cookies.getAll({ domain: `.${hostname}` }),
  ]);

  const byName = new Map<string, chrome.cookies.Cookie>();
  for (const cookie of batches.flat()) {
    const existing = byName.get(cookie.name);
    byName.set(cookie.name, existing ? pickCookie(existing, cookie) : cookie);
  }

  return Array.from(byName.values());
}

async function buildCookieHeader(env: KimchiEnv): Promise<string> {
  const cookies = await collectKimchiCookies(env);
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export async function fetchWithKimchiAuth(
  env: KimchiEnv,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const baseUrl = getBaseUrl(env);
  const cookieHeader = await buildCookieHeader(env);
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
}

async function verifySession(env: KimchiEnv): Promise<AuthState> {
  const checkedAt = new Date().toISOString();

  const sessionRes = await fetchWithKimchiAuth(env, "/api/auth/extension-session", {
    method: "GET",
  });

  if (sessionRes.ok) {
    const data = (await sessionRes.json()) as {
      authenticated?: boolean;
      email?: string;
    };
    if (data.authenticated) {
      return { authenticated: true, email: data.email, checkedAt };
    }
  }

  const jobsRes = await fetchWithKimchiAuth(env, "/api/jobs", { method: "GET" });
  if (jobsRes.ok) {
    return { authenticated: true, checkedAt };
  }

  const hasCookies = Boolean(await buildCookieHeader(env));
  return {
    authenticated: false,
    checkedAt,
    error: hasCookies
      ? `Signed in on ${getBaseUrl(env)}? Check popup environment matches your login tab.`
      : `No session on ${getBaseUrl(env)}. Sign in via the Kimchi tab first.`,
  };
}

export async function checkAuth(force = false): Promise<AuthState> {
  const cached = await getAuthCache();
  if (!force && cached && Date.now() - new Date(cached.checkedAt).getTime() < 30_000) {
    return cached;
  }

  const { env } = await getSettings();
  const cookieHeader = await buildCookieHeader(env);

  if (!cookieHeader) {
    const state: AuthState = {
      authenticated: false,
      checkedAt: new Date().toISOString(),
      error: `No Kimchi cookies for ${getBaseUrl(env)}.`,
    };
    await setAuthCache(state);
    return state;
  }

  try {
    const state = await verifySession(env);
    await setAuthCache(state);
    return state;
  } catch {
    const state: AuthState = {
      authenticated: false,
      checkedAt: new Date().toISOString(),
      error: "Could not reach Kimchi. Check your connection.",
    };
    await setAuthCache(state);
    return state;
  }
}

export async function openLoginTab(): Promise<number | undefined> {
  const { env } = await getSettings();
  const baseUrl = getBaseUrl(env);
  const tab = await chrome.tabs.create({ url: `${baseUrl}/login` });
  return tab.id;
}

export async function logout(): Promise<void> {
  await clearAuthCache();
}

export async function broadcastAuthState(auth: AuthState): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "AUTH_STATE_CHANGED", payload: auth });
  } catch {
    // popup may be closed
  }
}
