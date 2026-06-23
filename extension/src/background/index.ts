import { saveJob } from "../lib/api";
import { checkAuth, logout, openLoginTab } from "../lib/auth";
import type {
  BackgroundMessage,
  ParsedJob,
  SaveJobResult,
} from "../lib/types";

async function parseViaInjection(tabId: number): Promise<ParsedJob | null> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const win = window as unknown as { __kimchiParsePage?: () => unknown };
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

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const win = window as unknown as { __kimchiParsePage?: () => unknown };
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

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  void (async () => {
    switch (message.type) {
      case "GET_AUTH": {
        const auth = await checkAuth(Boolean(message.force));
        sendResponse({ type: "AUTH_STATE", payload: auth });
        return;
      }
      case "OPEN_LOGIN": {
        await openLoginTab();
        sendResponse({ ok: true });
        return;
      }
      case "LOGOUT": {
        await logout();
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
      default:
        sendResponse({ ok: false, error: "Unknown message" });
    }
  })();

  return true;
});
