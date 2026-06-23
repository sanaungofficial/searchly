import { getBaseUrl, kimchiCookieUrls } from "./config";
import { clearAuthCache, getAuthCache, getSettings, setAuthCache } from "./storage";
import type { AuthState, KimchiEnv } from "./types";

async function buildCookieHeader(env: KimchiEnv): Promise<string> {
  const cookies: chrome.cookies.Cookie[] = [];
  for (const url of kimchiCookieUrls(env)) {
    const batch = await chrome.cookies.getAll({ url });
    cookies.push(...batch);
  }

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const cookie of cookies) {
    if (seen.has(cookie.name)) continue;
    seen.add(cookie.name);
    parts.push(`${cookie.name}=${cookie.value}`);
  }
  return parts.join("; ");
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

export async function checkAuth(force = false): Promise<AuthState> {
  const cached = await getAuthCache();
  if (!force && cached && Date.now() - new Date(cached.checkedAt).getTime() < 60_000) {
    return cached;
  }

  const { env } = await getSettings();
  const cookieHeader = await buildCookieHeader(env);

  if (!cookieHeader) {
    const state: AuthState = { authenticated: false, checkedAt: new Date().toISOString() };
    await setAuthCache(state);
    return state;
  }

  try {
    const res = await fetchWithKimchiAuth(env, "/api/jobs", { method: "GET" });
    const state: AuthState = {
      authenticated: res.ok,
      checkedAt: new Date().toISOString(),
    };
    await setAuthCache(state);
    return state;
  } catch {
    const state: AuthState = { authenticated: false, checkedAt: new Date().toISOString() };
    await setAuthCache(state);
    return state;
  }
}

export async function openLoginTab(): Promise<void> {
  const { env } = await getSettings();
  const baseUrl = getBaseUrl(env);
  await chrome.tabs.create({ url: `${baseUrl}/login` });
}

export async function logout(): Promise<void> {
  await clearAuthCache();
}
