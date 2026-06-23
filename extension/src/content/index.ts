import { parseCurrentPage } from "./parse-page";
import { ensureFloatingButton, setButtonState, showToast } from "./ui";
import type { BackgroundMessage, SaveJobResult } from "../lib/types";

const ATS_HOST_RE =
  /(?:boards|job-boards)\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|linkedin\.com/i;

function isKnownAtsPage(): boolean {
  return ATS_HOST_RE.test(window.location.hostname);
}

async function saveCurrentPage(): Promise<SaveJobResult> {
  const parsed = parseCurrentPage();
  console.info("[Kimchi] parsed job", parsed);

  const response = await chrome.runtime.sendMessage({
    type: "SAVE_PARSED_JOB",
    payload: parsed,
  });

  return response as SaveJobResult;
}

async function handleSaveClick(): Promise<void> {
  setButtonState("loading");
  try {
    const result = await saveCurrentPage();
    if (result.ok) {
      setButtonState("success");
      showToast(`Saved ${result.jobId ? "to Kimchi" : ""}`, "success");
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PARSE_PAGE") {
    sendResponse(parseCurrentPage());
    return true;
  }

  if (message?.type === "TRIGGER_SAVE") {
    handleSaveClick().then(sendResponse);
    return true;
  }

  return false;
});

if (isKnownAtsPage()) {
  ensureFloatingButton(() => {
    void handleSaveClick();
  });
}

// Expose for popup-driven generic saves via executeScript
(window as unknown as { __kimchiParsePage?: () => ReturnType<typeof parseCurrentPage> }).__kimchiParsePage =
  parseCurrentPage;
