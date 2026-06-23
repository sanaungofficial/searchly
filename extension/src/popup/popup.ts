import { getBaseUrl } from "../lib/config";
import { getSettings, setSettings } from "../lib/storage";
import type { AuthState, BackgroundMessage, KimchiEnv, SaveJobResult } from "../lib/types";

const authStatus = document.getElementById("auth-status")!;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
const envSelect = document.getElementById("env-select") as HTMLSelectElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const saveHint = document.getElementById("save-hint")!;
const saveResult = document.getElementById("save-result")!;
const pipelineLink = document.getElementById("pipeline-link") as HTMLAnchorElement;

let authPollTimer: number | null = null;

function renderAuth(auth: AuthState): void {
  if (auth.authenticated) {
    authStatus.textContent = auth.email
      ? `Signed in as ${auth.email}`
      : "Signed in to Kimchi";
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    saveBtn.disabled = false;
  } else {
    authStatus.textContent = auth.error ?? "Not signed in";
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    saveBtn.disabled = true;
  }
}

async function refreshAuth(force = false): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_AUTH",
    force,
  } satisfies BackgroundMessage);

  if (response?.type === "AUTH_STATE") {
    renderAuth(response.payload as AuthState);
    if ((response.payload as AuthState).authenticated && authPollTimer) {
      window.clearInterval(authPollTimer);
      authPollTimer = null;
    }
    return;
  }

  renderAuth(response as AuthState);
}

function updatePipelineLink(env: KimchiEnv): void {
  pipelineLink.href = `${getBaseUrl(env)}/opportunities/pipeline`;
}

async function initSettings(): Promise<void> {
  const settings = await getSettings();
  envSelect.value = settings.env;
  updatePipelineLink(settings.env);
}

loginBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_LOGIN" } satisfies BackgroundMessage);
  authStatus.textContent = "Complete sign-in in the Kimchi tab…";

  if (authPollTimer) window.clearInterval(authPollTimer);
  authPollTimer = window.setInterval(() => {
    void refreshAuth(true);
  }, 1000);
});

logoutBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "LOGOUT" } satisfies BackgroundMessage);
  if (authPollTimer) {
    window.clearInterval(authPollTimer);
    authPollTimer = null;
  }
  await refreshAuth(true);
});

envSelect.addEventListener("change", async () => {
  const env = envSelect.value as KimchiEnv;
  await setSettings({ env });
  updatePipelineLink(env);
  await refreshAuth(true);
});

saveBtn.addEventListener("click", async () => {
  saveResult.hidden = true;
  saveResult.classList.remove("is-error");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    saveResult.textContent = "No active tab found.";
    saveResult.classList.add("is-error");
    saveResult.hidden = false;
    saveBtn.disabled = false;
    saveBtn.textContent = "Save current page";
    return;
  }

  const result = (await chrome.runtime.sendMessage({
    type: "SAVE_JOB",
    payload: { tabId: tab.id },
  } satisfies BackgroundMessage)) as SaveJobResult;

  if (result.ok) {
    saveResult.textContent = "Saved to Kimchi pipeline.";
    saveHint.textContent = "View it in Opportunities → Pipeline.";
  } else {
    saveResult.textContent = result.error ?? "Could not save this page.";
    saveResult.classList.add("is-error");
  }

  saveResult.hidden = false;
  saveBtn.disabled = false;
  saveBtn.textContent = "Save current page";
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "AUTH_STATE_CHANGED") {
    renderAuth(message.payload as AuthState);
    if ((message.payload as AuthState).authenticated && authPollTimer) {
      window.clearInterval(authPollTimer);
      authPollTimer = null;
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refreshAuth(true);
});

void initSettings();
void refreshAuth(true);
