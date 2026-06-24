import { saveJob } from "../lib/api";
import { fetchJobMatch } from "../lib/match";
import { broadcastAuthState, checkAuth, logout, openLoginTab } from "../lib/auth";
import { getBaseUrl } from "../lib/config";
import type {
  BackgroundMessage,
  ParsedJob,
  SaveJobResult,
} from "../lib/types";

let loginTabId: number | null = null;

function isUsableParsedJob(parsed: ParsedJob | null | undefined): parsed is ParsedJob {
  if (!parsed?.company || !parsed?.role) return false;
  return !(parsed.company === "Unknown Company" && parsed.role === "Unknown Role");
}

async function parseTab(tabId: number): Promise<ParsedJob | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: "PARSE_PAGE",
      })) as ParsedJob | null;
      if (isUsableParsedJob(response)) return response;
    } catch {
      // content script may still be loading on LinkedIn SPA
    }
    await new Promise((r) => setTimeout(r, 400 + attempt * 200));
  }
  return null;
}

async function saveFromTab(tabId: number): Promise<SaveJobResult> {
  const parsed = await parseTab(tabId);
  if (!isUsableParsedJob(parsed)) {
    return { ok: false, error: "Could not extract company and role from this page." };
  }
  return saveJob(parsed);
}

async function refreshAndBroadcastAuth(force = true): Promise<void> {
  const auth = await checkAuth(force);
  await broadcastAuthState(auth);
}

chrome.runtime.onInstalled.addListener(() => {
  void refreshAndBroadcastAuth(true);
});

chrome.action.onClicked.addListener(async () => {
  const auth = await checkAuth(true);
  const url = auth.authenticated
    ? `${getBaseUrl()}/opportunities/pipeline`
    : `${getBaseUrl()}/login`;
  await chrome.tabs.create({ url });
});

chrome.cookies.onChanged.addListener((change) => {
  const domain = change.cookie.domain.replace(/^\./, "");
  if (domain === "app.kimchi.so") {
    void refreshAndBroadcastAuth(true);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url ?? "";

  if (tabId === loginTabId && changeInfo.status === "complete") {
    if (
      /\/(dashboard|opportunities|profile|onboarding)(\/|$|\?)/.test(url) ||
      url.includes("/auth/callback")
    ) {
      loginTabId = null;
      void refreshAndBroadcastAuth(true);
    }
    return;
  }

  // Nudge LinkedIn job tabs to mount sidebar after SPA navigation
  if (changeInfo.status === "complete" && /linkedin\.com\/jobs/i.test(url)) {
    void chrome.tabs.sendMessage(tabId, { type: "REFRESH_UI" }).catch(() => {});
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
