import type { ParsedJob } from "../lib/types";
import { getBaseUrl } from "../lib/config";
import { getSettings } from "../lib/storage";

const WIDGET_ID = "kimchi-linkedin-widget";
const INLINE_BTN_CLASS = "kimchi-inline-save-btn";

function isLinkedInJobPage(): boolean {
  return /linkedin\.com/i.test(window.location.hostname) && /\/jobs\//i.test(window.location.href);
}

function findActionRow(): Element | null {
  return (
    document.querySelector(".job-details-jobs-unified-top-card__top-buttons") ??
    document.querySelector(".jobs-unified-top-card__content .mt4") ??
    document.querySelector(".jobs-s-apply")?.parentElement ??
    document.querySelector(".jobs-apply-button--top-card")?.parentElement ??
    null
  );
}

function findWidgetMount(): Element | null {
  const actionRow = findActionRow();
  if (actionRow?.parentElement) return actionRow.parentElement;

  return (
    document.querySelector(".job-details-jobs-unified-top-card__sticky-header") ??
    document.querySelector(".jobs-unified-top-card__content") ??
    document.querySelector(".jobs-search__job-details") ??
    null
  );
}

function formatPreview(parsed: ParsedJob): string {
  try {
    const meta = JSON.parse(parsed.notes) as { location?: string };
    const parts = [parsed.company, meta.location].filter(Boolean);
    return parts.join(" · ");
  } catch {
    return parsed.company;
  }
}

function setInlineButtonState(button: HTMLButtonElement, state: "idle" | "loading" | "success" | "error"): void {
  button.disabled = state === "loading";
  button.dataset.state = state;
  switch (state) {
    case "idle":
      button.textContent = "Save to Kimchi";
      break;
    case "loading":
      button.textContent = "Saving…";
      break;
    case "success":
      button.textContent = "Saved ✓";
      break;
    case "error":
      button.textContent = "Retry save";
      break;
  }
}

function setWidgetState(
  widget: HTMLElement,
  state: "idle" | "loading" | "success" | "error",
  message?: string
): void {
  widget.dataset.state = state;
  const status = widget.querySelector<HTMLElement>(".kimchi-li-widget__status");
  const saveBtn = widget.querySelector<HTMLButtonElement>(".kimchi-li-widget__save");
  const inlineBtn = document.querySelector<HTMLButtonElement>(`.${INLINE_BTN_CLASS}`);

  if (saveBtn) setInlineButtonState(saveBtn, state);
  if (inlineBtn) setInlineButtonState(inlineBtn, state);

  if (status && message) status.textContent = message;
}

export function removeLinkedInWidget(): void {
  document.getElementById(WIDGET_ID)?.remove();
  document.querySelector(`.${INLINE_BTN_CLASS}`)?.remove();
}

export async function mountLinkedInWidget(
  parsed: ParsedJob,
  onSave: () => Promise<void>
): Promise<void> {
  if (!isLinkedInJobPage()) return;

  removeLinkedInWidget();

  const preview = formatPreview(parsed);
  const mount = findWidgetMount();
  if (!mount) return;

  const { env } = await getSettings();
  const pipelineUrl = `${getBaseUrl(env)}/opportunities/pipeline`;

  const actionRow = findActionRow();
  if (actionRow) {
    const inlineBtn = document.createElement("button");
    inlineBtn.type = "button";
    inlineBtn.className = INLINE_BTN_CLASS;
    inlineBtn.textContent = "Save to Kimchi";
    inlineBtn.addEventListener("click", () => {
      void onSave();
    });
    actionRow.appendChild(inlineBtn);
  }

  const widget = document.createElement("section");
  widget.id = WIDGET_ID;
  widget.className = "kimchi-li-widget";
  widget.innerHTML = `
    <div class="kimchi-li-widget__body">
      <div class="kimchi-li-widget__copy">
        <div class="kimchi-li-widget__eyebrow">Kimchi</div>
        <div class="kimchi-li-widget__title">Save this role to your pipeline</div>
        <div class="kimchi-li-widget__meta">${preview || parsed.role}</div>
        <div class="kimchi-li-widget__status"></div>
      </div>
      <div class="kimchi-li-widget__actions">
        <button type="button" class="kimchi-li-widget__save">Save to Kimchi</button>
        <a class="kimchi-li-widget__link" href="${pipelineUrl}" target="_blank" rel="noreferrer">Open pipeline</a>
      </div>
    </div>
    <div class="kimchi-li-widget__footer">
      <span class="kimchi-li-widget__brand">Kimchi</span>
      <span class="kimchi-li-widget__hint">Track applications in one place</span>
    </div>
  `;

  const saveBtn = widget.querySelector<HTMLButtonElement>(".kimchi-li-widget__save");
  saveBtn?.addEventListener("click", () => {
    void onSave();
  });

  if (actionRow?.parentElement) {
    actionRow.parentElement.insertBefore(widget, actionRow.nextSibling);
  } else {
    mount.prepend(widget);
  }
}

export function updateLinkedInWidgetPreview(parsed: ParsedJob): void {
  const widget = document.getElementById(WIDGET_ID);
  if (!widget) return;
  const meta = widget.querySelector(".kimchi-li-widget__meta");
  if (meta) meta.textContent = formatPreview(parsed) || parsed.role;
}

export { setWidgetState, isLinkedInJobPage };

export function observeLinkedInNavigation(onJobChange: () => void): void {
  if (!isLinkedInJobPage()) return;

  let lastUrl = window.location.href;
  let debounceTimer: number | null = null;

  const schedule = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const url = window.location.href;
      const widgetMissing = !document.getElementById(WIDGET_ID);
      if (url !== lastUrl || widgetMissing) {
        lastUrl = url;
        onJobChange();
      }
    }, 500);
  };

  window.addEventListener("popstate", schedule);
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
}
