import type { ExtensionSettings, KimchiEnv } from "./types";

export const KIMCHI_URLS: Record<KimchiEnv, string> = {
  prod: "https://app.kimchi.so",
  dev: "https://kimchi-git-dev-second-ladder.vercel.app",
};

export const DEFAULT_SETTINGS: ExtensionSettings = { env: "dev" };

export const STORAGE_KEYS = {
  settings: "kimchi_settings",
  auth: "kimchi_auth_cache",
} as const;

export function getBaseUrl(env: KimchiEnv): string {
  return KIMCHI_URLS[env];
}

/** Domains where chrome.cookies can read Kimchi session cookies. */
export function kimchiCookieUrls(env: KimchiEnv): string[] {
  const base = getBaseUrl(env);
  return [base, `${base}/`];
}
