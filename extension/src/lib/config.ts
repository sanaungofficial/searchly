import type { ExtensionSettings } from "./types";

export const KIMCHI_BASE_URL = "https://app.kimchi.so";

/** Production-only — no dev/staging toggle in the shipped extension. */
export const DEFAULT_SETTINGS: ExtensionSettings = { env: "prod" };

export const STORAGE_KEYS = {
  settings: "kimchi_settings",
  auth: "kimchi_auth_cache",
} as const;

export function getBaseUrl(): string {
  return KIMCHI_BASE_URL;
}

export function kimchiCookieUrls(): string[] {
  return [KIMCHI_BASE_URL, `${KIMCHI_BASE_URL}/`];
}
