import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./config";
import type { AuthState, ExtensionSettings } from "./types";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.settings);
  const settings = result[STORAGE_KEYS.settings] as ExtensionSettings | undefined;
  return settings ?? DEFAULT_SETTINGS;
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.settings]: settings });
}

export async function getAuthCache(): Promise<AuthState | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.auth);
  return (result[STORAGE_KEYS.auth] as AuthState | undefined) ?? null;
}

export async function setAuthCache(auth: AuthState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth });
}

export async function clearAuthCache(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.auth);
}
