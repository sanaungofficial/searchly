import { parseCurrentPage, parseCurrentPageAsync } from "./parse-page";
import {
  JobRightUI,
  fetchMatchFromBackground,
  isLinkedInJobPage,
  observeLinkedInNavigation,
  placeholderJob,
} from "./jobright-ui";
import { ensureFloatingButton, setButtonState, showToast } from "./ui";
import type { AuthState, ParsedJob, SaveJobResult } from "../lib/types";

const ATS_HOST_RE =
  /(?:boards|job-boards)\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com/i;

const KIMCHI_LOADED_KEY = "__kimchiExtensionLoaded";

function isUsableParsedJob(parsed: ParsedJob | null | undefined): parsed is ParsedJob {
  if (!parsed?.company || !parsed?.role) return false;
  return !(parsed.company === "Unknown Company" && parsed.role === "Unknown Role");
}

function isKnownAtsPage(): boolean {
  return ATS_HOST_RE.test(window.location.hostname);
}

async function getAuth(force = false): Promise<AuthState> {
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTH", force });
  if (response?.type === "AUTH_STATE") return response.payload as AuthState;
  return response as AuthState;
}

async function saveParsedJob(): Promise<SaveJobResult> {
  const parsed = await parseCurrentPageAsync();
  return (await chrome.runtime.sendMessage({
    type: "SAVE_PARSED_JOB",
    payload: parsed,
  })) as SaveJobResult;
}

async function handleSaveClick(): Promise<void> {
  setButtonState("loading");
  try {
    const result = await saveParsedJob();
    if (result.ok) {
      setButtonState("success");
      showToast("Saved to Kimchi", "success");
      window.setTimeout(() => setButtonState("idle"), 2500);
    } else {
      setButtonState("error");
      showToast(result.error ?? "Could not save job", "error");
    }
  } catch (err) {
    setButtonState("error");
    showToast(err instanceof Error ? err.message : "Save failed", "error");
  }
}

let linkedInUI: JobRightUI | null = null;
let linkedInRefreshTimer: number | null = null;
let linkedInRefreshRunning = false;

async function refreshLinkedInUI(): Promise<void> {
  if (!isLinkedInJobPage()) {
    linkedInUI?.teardown();
    linkedInUI = null;
    return;
  }

  if (linkedInRefreshRunning) return;
  linkedInRefreshRunning = true;

  try {
    if (!linkedInUI) {
      linkedInUI = new JobRightUI(async () => {
        const fresh = await parseCurrentPageAsync();
        return (await chrome.runtime.sendMessage({
          type: "SAVE_PARSED_JOB",
          payload: fresh,
        })) as SaveJobResult;
      });
    }

    const auth = await getAuth();

    // Show sidebar immediately — don't wait for parse
    await linkedInUI.render(placeholderJob(), null, auth, true);

    for (let attempt = 0; attempt < 12; attempt++) {
      const parsed = await parseCurrentPageAsync();
      if (isUsableParsedJob(parsed)) {
        const match = auth.authenticated ? await fetchMatchFromBackground(parsed) : null;
        await linkedInUI.render(parsed, match, auth, false);
        return;
      }
      await new Promise((r) => setTimeout(r, 400 + attempt * 150));
    }

    await linkedInUI.render(placeholderJob(), null, auth, false);
  } finally {
    linkedInRefreshRunning = false;
  }
}

function scheduleLinkedInRefresh(): void {
  if (linkedInRefreshTimer) window.clearTimeout(linkedInRefreshTimer);
  linkedInRefreshTimer = window.setTimeout(() => {
    void refreshLinkedInUI();
  }, 300);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PARSE_PAGE") {
    if (/linkedin\.com/i.test(window.location.hostname)) {
      parseCurrentPageAsync().then(sendResponse);
    } else {
      sendResponse(parseCurrentPage());
    }
    return true;
  }

  if (message?.type === "REFRESH_UI" || message?.type === "AUTH_STATE_CHANGED") {
    scheduleLinkedInRefresh();
    return false;
  }

  if (message?.type === "TRIGGER_SAVE") {
    saveParsedJob().then(sendResponse);
    return true;
  }

  return false;
});

function bootLinkedInUI(): void {
  observeLinkedInNavigation(scheduleLinkedInRefresh);
  scheduleLinkedInRefresh();
}

function bootFloatingButton(): void {
  ensureFloatingButton(() => {
    void handleSaveClick();
  });
}

function initKimchiContent(): void {
  if (isLinkedInJobPage()) {
    bootLinkedInUI();
  } else if (isKnownAtsPage()) {
    bootFloatingButton();
  }
}

const win = window as unknown as Record<string, unknown>;
if (win[KIMCHI_LOADED_KEY]) {
  if (isLinkedInJobPage()) scheduleLinkedInRefresh();
} else {
  win[KIMCHI_LOADED_KEY] = true;
  initKimchiContent();
}

(window as unknown as {
  __kimchiParsePage?: () => ReturnType<typeof parseCurrentPage>;
  __kimchiParsePageAsync?: () => Promise<ParsedJob>;
}).__kimchiParsePage = parseCurrentPage;

(
  window as unknown as {
    __kimchiParsePage?: () => ReturnType<typeof parseCurrentPage>;
    __kimchiParsePageAsync?: () => Promise<ParsedJob>;
  }
).__kimchiParsePageAsync = parseCurrentPageAsync;
