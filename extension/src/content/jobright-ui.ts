import { getBaseUrl } from "../lib/config";
import { getSettings } from "../lib/storage";
import type { JobMatchResult, ParsedJob, SaveJobResult } from "../lib/types";
import { getDescriptionFromParsed } from "../parsers/linkedin-jobs";

const SIDEBAR_ID = "kimchi-jr-sidebar";
const MATCH_CARD_ID = "kimchi-jr-match-card";
const INLINE_BTN_CLASS = "kimchi-jr-inline-btn";
const ROOT_CLASS = "kimchi-jr-active";
const SIDEBAR_WIDTH = 380;
const COLLAPSED_WIDTH = 0;

export function isLinkedInJobPage(): boolean {
  return /linkedin\.com/i.test(window.location.hostname) && /\/jobs\//i.test(window.location.href);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function findActionRow(): Element | null {
  return (
    document.querySelector(".job-details-jobs-unified-top-card__top-buttons") ??
    document.querySelector(".top-card-layout__cta-container") ??
    document.querySelector(".jobs-unified-top-card__content .mt4") ??
    document.querySelector(".jobs-s-apply")?.parentElement ??
    document.querySelector(".jobs-apply-button--top-card")?.parentElement ??
    null
  );
}

function findMatchMount(): Element | null {
  const actionRow = findActionRow();
  if (actionRow?.parentElement) return actionRow.parentElement;
  return (
    document.querySelector(".job-details-jobs-unified-top-card__sticky-header") ??
    document.querySelector(".jobs-unified-top-card__content") ??
    document.querySelector(".top-card-layout__card") ??
    document.querySelector(".top-card-layout") ??
    null
  );
}

function matchHeadline(score: number, label?: string): string {
  if (label) return `${label} for This Job`;
  if (score >= 8) return "Strong Match for This Job";
  if (score >= 6) return "Moderate Match for This Job";
  return "Low Match for This Job";
}

function gaugeLabel(score: number, label?: string): string {
  if (label) return label;
  if (score >= 8) return "Strong";
  if (score >= 6) return "Fair";
  return "Poor";
}

function keywordCopy(match: JobMatchResult | null): string {
  if (!match?.keywords?.length) {
    return "Save this role to Kimchi and analyze your resume match.";
  }
  const matched = match.keywords.filter((k) => k.matched).length;
  const total = match.keywords.length;
  return `${matched} out of ${total} keywords are present in your resume, let's fix it.`;
}

function renderGauge(score: number): string {
  const dash = (Math.max(0, Math.min(100, (score / 10) * 100)) / 100) * 126;
  return `
    <svg class="kimchi-jr-gauge" viewBox="0 0 120 72" aria-hidden="true">
      <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#e5e7eb" stroke-width="10" stroke-linecap="round"/>
      <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="url(#kimchiGaugeGrad)" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${dash} 126"/>
      <defs>
        <linearGradient id="kimchiGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#14b8a6"/>
        </linearGradient>
      </defs>
      <text x="60" y="58" text-anchor="middle" class="kimchi-jr-gauge__score">${score.toFixed(1)}</text>
    </svg>
  `;
}

function renderRing(score: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((score / 10) * 100)));
  return `
    <div class="kimchi-jr-ring" style="--pct:${pct}">
      <div class="kimchi-jr-ring__inner">${pct}%</div>
    </div>
  `;
}

export class JobRightUI {
  constructor(
    private onSave: () => Promise<SaveJobResult>,
    _onMatch: (parsed: ParsedJob) => Promise<JobMatchResult | null>
  ) {}

  teardown(): void {
    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(MATCH_CARD_ID)?.remove();
    document.querySelector(`.${INLINE_BTN_CLASS}`)?.remove();
    document.documentElement.classList.remove(ROOT_CLASS);
    document.documentElement.style.removeProperty("--kimchi-jr-sidebar-width");
  }

  private setSidebarWidth(width: number): void {
    document.documentElement.style.setProperty("--kimchi-jr-sidebar-width", `${width}px`);
  }

  async mount(parsed: ParsedJob, match: JobMatchResult | null): Promise<void> {
    if (!isLinkedInJobPage()) return;
    this.teardown();
    document.documentElement.classList.add(ROOT_CLASS);
    this.setSidebarWidth(SIDEBAR_WIDTH);

    const { env } = await getSettings();
    const baseUrl = getBaseUrl(env);
    const description = getDescriptionFromParsed(parsed);
    const score = match?.score ?? 0;
    const hasMatch = Boolean(match?.score);

    this.mountInlineButton();
    this.mountMatchCard(parsed, match);
    this.mountSidebar(parsed, baseUrl, score, hasMatch, description);
  }

  private mountInlineButton(): void {
    const row = findActionRow();
    if (!row || row.querySelector(`.${INLINE_BTN_CLASS}`)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = INLINE_BTN_CLASS;
    btn.innerHTML = `<span class="kimchi-jr-spark">✦</span> Apply with Kimchi`;
    btn.addEventListener("click", () => void this.handleSave());
    row.appendChild(btn);
  }

  private mountMatchCard(parsed: ParsedJob, match: JobMatchResult | null): void {
    const mount = findMatchMount();
    if (!mount) return;

    const score = match?.score ?? 0;
    const hasMatch = Boolean(match?.score);
    const card = document.createElement("section");
    card.id = MATCH_CARD_ID;
    card.className = "kimchi-jr-match-card";
    card.innerHTML = `
      <div class="kimchi-jr-match-card__body">
        <div class="kimchi-jr-match-card__copy">
          <div class="kimchi-jr-match-card__title">${escapeHtml(matchHeadline(score, match?.scoreLabel))}</div>
          <div class="kimchi-jr-match-card__subtitle">${escapeHtml(keywordCopy(match))}</div>
        </div>
        <div class="kimchi-jr-match-card__gauge-wrap">
          ${renderGauge(hasMatch ? score : 0)}
          <div class="kimchi-jr-match-card__gauge-label">${escapeHtml(hasMatch ? gaugeLabel(score, match?.scoreLabel) : "—")}</div>
        </div>
      </div>
      <div class="kimchi-jr-match-card__footer">
        <span class="kimchi-jr-match-card__brand">Kimchi</span>
        <button type="button" class="kimchi-jr-match-card__save">Save to pipeline</button>
      </div>
    `;

    card.querySelector(".kimchi-jr-match-card__save")?.addEventListener("click", () => {
      void this.handleSave();
    });

    const actionRow = findActionRow();
    if (actionRow?.parentElement) {
      actionRow.parentElement.insertBefore(card, actionRow.nextSibling);
    } else {
      mount.prepend(card);
    }
  }

  private mountSidebar(
    parsed: ParsedJob,
    baseUrl: string,
    score: number,
    hasMatch: boolean,
    description: string
  ): void {
    const sidebar = document.createElement("aside");
    sidebar.id = SIDEBAR_ID;
    sidebar.className = "kimchi-jr-sidebar";
    sidebar.innerHTML = `
      <div class="kimchi-jr-sidebar__header">
        <div class="kimchi-jr-sidebar__logo">Kimchi</div>
        <div class="kimchi-jr-sidebar__header-actions">
          <a class="kimchi-jr-sidebar__link" href="${baseUrl}/opportunities/pipeline" target="_blank" rel="noreferrer">Feedback</a>
          <button type="button" class="kimchi-jr-sidebar__icon-btn" data-action="collapse" title="Collapse">›</button>
        </div>
      </div>

      <div class="kimchi-jr-sidebar__job-card">
        <div class="kimchi-jr-sidebar__job-top">
          <div class="kimchi-jr-sidebar__company-mark">${escapeHtml(initials(parsed.company))}</div>
          <div class="kimchi-jr-sidebar__job-meta">
            <div class="kimchi-jr-sidebar__company">${escapeHtml(parsed.company)}</div>
            <div class="kimchi-jr-sidebar__role">${escapeHtml(parsed.role)}</div>
          </div>
          ${hasMatch ? renderRing(score) : ""}
        </div>
      </div>

      <div class="kimchi-jr-sidebar__section">
        <div class="kimchi-jr-sidebar__section-title"><span class="kimchi-jr-dot"></span> Your Kimchi Profile</div>
        <div class="kimchi-jr-sidebar__section-copy">Resume and pipeline sync from your Kimchi account.</div>
      </div>

      <div class="kimchi-jr-sidebar__section">
        <div class="kimchi-jr-sidebar__section-title">Improve Resume Match</div>
        <button type="button" class="kimchi-jr-sidebar__cta kimchi-jr-sidebar__cta--primary" data-action="optimize">
          <span class="kimchi-jr-spark">✦</span> Optimize my resume
        </button>
      </div>

      <div class="kimchi-jr-sidebar__section">
        <div class="kimchi-jr-sidebar__section-title">Build Cover Letter</div>
        <button type="button" class="kimchi-jr-sidebar__cta kimchi-jr-sidebar__cta--secondary" data-action="cover">
          <span class="kimchi-jr-spark">✦</span> Build cover letter
        </button>
      </div>

      <div class="kimchi-jr-sidebar__section">
        <button type="button" class="kimchi-jr-sidebar__cta kimchi-jr-sidebar__cta--save" data-action="save">
          Save to Kimchi pipeline
        </button>
        <div class="kimchi-jr-sidebar__hint">${description ? "Job description captured." : "Expand the full description on LinkedIn for better match."}</div>
      </div>

      <div class="kimchi-jr-sidebar__footer">
        <a href="${baseUrl}/opportunities/pipeline" target="_blank" rel="noreferrer">Save another job in Kimchi</a>
      </div>
    `;

    sidebar.querySelector('[data-action="collapse"]')?.addEventListener("click", () => {
      sidebar.classList.toggle("is-collapsed");
      this.setSidebarWidth(sidebar.classList.contains("is-collapsed") ? COLLAPSED_WIDTH : SIDEBAR_WIDTH);
    });

    sidebar.querySelector('[data-action="save"]')?.addEventListener("click", () => {
      void this.handleSave();
    });

    sidebar.querySelector('[data-action="optimize"]')?.addEventListener("click", () => {
      window.open(`${baseUrl}/opportunities/pipeline`, "_blank");
    });

    sidebar.querySelector('[data-action="cover"]')?.addEventListener("click", () => {
      window.open(`${baseUrl}/opportunities/pipeline`, "_blank");
    });

    document.body.appendChild(sidebar);
  }

  private async handleSave(): Promise<void> {
    this.setSavingState(true);
    const result = await this.onSave();
    this.setSavingState(false);

    if (result.ok) {
      this.setStatus("Saved to your Kimchi pipeline.");
    } else {
      this.setStatus(result.error ?? "Could not save job", true);
    }
  }

  private setSavingState(loading: boolean): void {
    document.querySelectorAll<HTMLButtonElement>(
      `.${INLINE_BTN_CLASS}, .kimchi-jr-match-card__save, .kimchi-jr-sidebar__cta--save`
    ).forEach((btn) => {
      btn.disabled = loading;
      if (loading) btn.dataset.loading = "true";
      else delete btn.dataset.loading;
    });
  }

  private setStatus(message: string, isError = false): void {
    const subtitle = document.querySelector(".kimchi-jr-match-card__subtitle");
    if (subtitle) {
      subtitle.textContent = message;
      subtitle.classList.toggle("is-error", isError);
    }
  }
}

export function observeLinkedInNavigation(onChange: () => void): void {
  let lastUrl = window.location.href;
  let timer: number | null = null;

  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const url = window.location.href;
      if (url !== lastUrl || !document.getElementById(SIDEBAR_ID)) {
        lastUrl = url;
        onChange();
      }
    }, 600);
  };

  window.addEventListener("popstate", schedule);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
}

export async function fetchMatchFromBackground(parsed: ParsedJob): Promise<JobMatchResult | null> {
  const description = getDescriptionFromParsed(parsed);
  if (!description) return null;

  const response = await chrome.runtime.sendMessage({
    type: "JOB_MATCH",
    payload: {
      jobTitle: parsed.role,
      company: parsed.company,
      description,
    },
  });

  if (response?.ok && response.data) return response.data as JobMatchResult;
  return null;
}
