import { getBaseUrl, kimchiCookieUrls } from "./config";
import { clearAuthCache, getAuthCache, setAuthCache } from "./storage";
import type { AuthState } from "./types";

function pickCookie(existing: chrome.cookies.Cookie, next: chrome.cookies.Cookie): chrome.cookies.Cookie {
  if (existing.path === "/" && next.path !== "/") return existing;
  if (next.path === "/" && existing.path !== "/") return next;
  return next.value.length > existing.value.length ? next : existing;
}

async function collectKimchiCookies(): Promise<chrome.cookies.Cookie[]> {
  const batches = await Promise.all(
    kimchiCookieUrls().flatMap((url) => {
      const hostname = new URL(url).hostname;
      return [
        chrome.cookies.getAll({ url }),
        chrome.cookies.getAll({ domain: hostname }),
        chrome.cookies.getAll({ domain: `.${hostname}` }),
      ];
    })
  );

  const byName = new Map<string, chrome.cookies.Cookie>();
  for (const cookie of batches.flat()) {
    const existing = byName.get(cookie.name);
    byName.set(cookie.name, existing ? pickCookie(existing, cookie) : cookie);
  }

  return Array.from(byName.values());
}

async function buildCookieHeader(): Promise<string> {
  const cookies = await collectKimchiCookies();
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export async function fetchWithKimchiAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieHeader = await buildCookieHeader();
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  return fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}

async function verifySession(): Promise<AuthState> {
  const checkedAt = new Date().toISOString();

  const sessionRes = await fetchWithKimchiAuth("/api/auth/extension-session", {
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

  const jobsRes = await fetchWithKimchiAuth("/api/jobs", { method: "GET" });
  if (jobsRes.ok) {
    return { authenticated: true, checkedAt };
  }

  const hasCookies = Boolean(await buildCookieHeader());
  return {
    authenticated: false,
    checkedAt,
    error: hasCookies
      ? "Session expired. Sign in again at Kimchi."
      : "Sign in to Kimchi to save jobs and see your match score.",
  };
}

export async function checkAuth(force = false): Promise<AuthState> {
  const cached = await getAuthCache();
  if (!force && cached && Date.now() - new Date(cached.checkedAt).getTime() < 30_000) {
    return cached;
  }

  const cookieHeader = await buildCookieHeader();

  if (!cookieHeader) {
    const state: AuthState = {
      authenticated: false,
      checkedAt: new Date().toISOString(),
      error: "Sign in to Kimchi to save jobs and see your match score.",
    };
    await setAuthCache(state);
    return state;
  }

  try {
    const state = await verifySession();
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
  const tab = await chrome.tabs.create({ url: `${getBaseUrl()}/login` });
  return tab.id;
}

export async function logout(): Promise<void> {
  await clearAuthCache();
}

export async function broadcastAuthState(auth: AuthState): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "AUTH_STATE_CHANGED", payload: auth });
  } catch {
    // no listeners
  }

  const tabs = await chrome.tabs.query({ url: ["https://www.linkedin.com/*", "https://linkedin.com/*"] });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "AUTH_STATE_CHANGED", payload: auth });
    } catch {
      // tab has no content script yet
    }
  }
}
