import { saveJob } from "../lib/api";
import { fetchJobMatch } from "../lib/match";
import { broadcastAuthState, checkAuth, logout, openLoginTab } from "../lib/auth";
import type {
  BackgroundMessage,
  ParsedJob,
  SaveJobResult,
} from "../lib/types";

let loginTabId: number | null = null;

async function parseViaInjection(tabId: number): Promise<ParsedJob | null> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const win = window as unknown as {
          __kimchiParsePage?: () => unknown;
          __kimchiParsePageAsync?: () => Promise<unknown>;
        };
        if (win.__kimchiParsePageAsync) return win.__kimchiParsePageAsync();
        return win.__kimchiParsePage?.() ?? null;
      },
    });
    if (result) return result as ParsedJob;
  } catch {
    // content script not present yet
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content.css"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });

    await new Promise((r) => setTimeout(r, 800));

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const win = window as unknown as {
          __kimchiParsePage?: () => unknown;
          __kimchiParsePageAsync?: () => Promise<unknown>;
        };
        if (win.__kimchiParsePageAsync) return win.__kimchiParsePageAsync();
        return win.__kimchiParsePage?.() ?? null;
      },
    });
    return (result as ParsedJob | null) ?? null;
  } catch (err) {
    console.error("[Kimchi] parseViaInjection failed", err);
    return null;
  }
}

async function parseTab(tabId: number): Promise<ParsedJob | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "PARSE_PAGE" });
    return response as ParsedJob;
  } catch {
    return parseViaInjection(tabId);
  }
}

async function saveFromTab(tabId: number): Promise<SaveJobResult> {
  const parsed = await parseTab(tabId);

  if (!parsed?.company || !parsed?.role) {
    return { ok: false, error: "Could not extract company and role from this page." };
  }

  return saveJob(parsed);
}

async function refreshAndBroadcastAuth(force = true): Promise<void> {
  const auth = await checkAuth(force);
  await broadcastAuthState(auth);
}

chrome.cookies.onChanged.addListener((change) => {
  const domain = change.cookie.domain.replace(/^\./, "");
  if (domain === "app.kimchi.so" || domain.endsWith("vercel.app")) {
    void refreshAndBroadcastAuth(true);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== loginTabId || changeInfo.status !== "complete") return;
  const url = tab.url ?? "";
  if (
    /\/(dashboard|opportunities|profile|onboarding)(\/|$|\?)/.test(url) ||
    url.includes("/auth/callback")
  ) {
    loginTabId = null;
    void refreshAndBroadcastAuth(true);
  }
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  void (async () => {
    switch (message.type) {
      case "GET_AUTH": {
        const auth = await checkAuth(Boolean(message.force));
        sendResponse({ type: "AUTH_STATE", payload: auth });
        return;
      }
      case "OPEN_LOGIN": {
        loginTabId = (await openLoginTab()) ?? null;
        sendResponse({ ok: true });
        return;
      }
      case "LOGOUT": {
        await logout();
        await refreshAndBroadcastAuth(true);
        sendResponse({ ok: true });
        return;
      }
      case "SAVE_PARSED_JOB": {
        sendResponse(await saveJob(message.payload));
        return;
      }
      case "SAVE_JOB": {
        const tabId = message.payload?.tabId;
        if (!tabId) {
          sendResponse({ ok: false, error: "No active tab" });
          return;
        }
        sendResponse(await saveFromTab(tabId));
        return;
      }
      case "PARSE_PAGE": {
        sendResponse({ type: "PARSED_JOB", payload: await parseTab(message.payload.tabId) });
        return;
      }
      case "JOB_MATCH": {
        sendResponse(await fetchJobMatch(message.payload));
        return;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message" });
    }
  })();

  return true;
});
