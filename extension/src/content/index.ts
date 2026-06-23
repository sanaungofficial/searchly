import { parseCurrentPageAsync } from "./parse-page";
import {
  isLinkedInJobPage,
  mountLinkedInWidget,
  observeLinkedInNavigation,
  removeLinkedInWidget,
  setWidgetState,
  updateLinkedInWidgetPreview,
} from "./linkedin-widget";
import { ensureFloatingButton, setButtonState, showToast } from "./ui";
import type { SaveJobResult } from "../lib/types";

const ATS_HOST_RE =
  /(?:boards|job-boards)\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|linkedin\.com/i;

function isKnownAtsPage(): boolean {
  return ATS_HOST_RE.test(window.location.hostname);
}

async function saveCurrentPage(): Promise<SaveJobResult> {
  const parsed = await parseCurrentPageAsync();
  console.info("[Kimchi] parsed job", parsed);

  if (isLinkedInJobPage()) {
    updateLinkedInWidgetPreview(parsed);
  }

  const response = await chrome.runtime.sendMessage({
    type: "SAVE_PARSED_JOB",
    payload: parsed,
  });

  return response as SaveJobResult;
}

async function handleSaveClick(): Promise<void> {
  const widget = document.getElementById("kimchi-linkedin-widget");
  if (isLinkedInJobPage() && widget) {
    setWidgetState(widget, "loading");
  } else {
    setButtonState("loading");
  }

  try {
    const result = await saveCurrentPage();
    if (result.ok) {
      if (isLinkedInJobPage() && widget) {
        setWidgetState(widget, "success", "Saved to your Kimchi pipeline.");
      } else {
        setButtonState("success");
        showToast("Saved to Kimchi", "success");
        window.setTimeout(() => setButtonState("idle"), 2500);
      }
    } else {
      if (isLinkedInJobPage() && widget) {
        setWidgetState(widget, "error", result.error ?? "Could not save job");
      } else {
        setButtonState("error");
        showToast(result.error ?? "Could not save job", "error");
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    if (isLinkedInJobPage() && widget) {
      setWidgetState(widget, "error", message);
    } else {
      setButtonState("error");
      showToast(message, "error");
    }
  }
}

async function refreshLinkedInWidget(): Promise<void> {
  if (!isLinkedInJobPage()) return;
  removeLinkedInWidget();
  const parsed = await parseCurrentPageAsync();
  await mountLinkedInWidget(parsed, handleSaveClick);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PARSE_PAGE") {
    parseCurrentPageAsync().then(sendResponse);
    return true;
  }

  if (message?.type === "TRIGGER_SAVE") {
    handleSaveClick().then(sendResponse);
    return true;
  }

  return false;
});

if (isLinkedInJobPage()) {
  void refreshLinkedInWidget();
  observeLinkedInNavigation(() => {
    void refreshLinkedInWidget();
  });
} else if (isKnownAtsPage()) {
  ensureFloatingButton(() => {
    void handleSaveClick();
  });
}

(window as unknown as { __kimchiParsePage?: () => ReturnType<typeof parseCurrentPageAsync> }).__kimchiParsePage =
  parseCurrentPageAsync;
