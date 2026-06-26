"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ChatChip } from "@/lib/kimchi-assistant/chat-chips";
import type { AssistantSuggestion, AssistantInboxSnapshot } from "@/lib/kimchi-assistant/types";
import { InboxInsightRow } from "@/components/scout/inbox/inbox-insight-row";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { fontSans } from "@/lib/typography";

const sans = fontSans;

export function KimchiChipRow({
  chips,
  label,
  onSelect,
}: {
  chips: ChatChip[];
  label?: string;
  onSelect: (prompt: string) => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="kimchi-chips">
      {label && <p className="kimchi-chips__label">{label}</p>}
      <div className="kimchi-chips__row">
        {chips.map((chip) => (
          <button key={chip.id} type="button" className="kimchi-chips__chip" onClick={() => onSelect(chip.prompt)}>
            {chip.label}
          </button>
        ))}
      </div>
      <KimchiChipStyles />
    </div>
  );
}

function KimchiChipStyles() {
  return (
    <style>{`
      .kimchi-chips {
        margin: 0 0 14px;
      }
      .kimchi-chips__label {
        margin: 0 0 8px;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.5);
      }
      .kimchi-chips__row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .kimchi-chips__chip {
        padding: 10px 14px;
        background: #fff;
        border: 1.5px solid rgba(26, 58, 47, 0.14);
        border-radius: 999px;
        font-family: ${sans};
        font-size: 14px;
        font-weight: 600;
        line-height: 1.3;
        color: #1A3A2F;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .kimchi-chips__chip:hover {
        background: rgba(26, 58, 47, 0.05);
        border-color: rgba(26, 58, 47, 0.28);
      }
    `}</style>
  );
}

type Props = {
  suggestions: AssistantSuggestion[];
  collapsed: boolean;
  onExpand: () => void;
  onSelect: (s: AssistantSuggestion) => void;
};

export function KimchiDoNextStrip({ suggestions, collapsed, onExpand, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  if (collapsed) {
    return (
      <button type="button" className="kimchi-do-next-collapsed" onClick={onExpand}>
        <span>{suggestions.length} suggested next</span>
        <span className="kimchi-do-next-collapsed__chev">Show</span>
      </button>
    );
  }

  return (
    <div className="kimchi-do-next">
      <p className="kimchi-do-next__label">Suggested next</p>
      <div className="kimchi-do-next__list">
        {suggestions.slice(0, 4).map((s) => (
          <button key={s.id} type="button" className="kimchi-do-next__card" onClick={() => onSelect(s)}>
            <span className="kimchi-do-next__title">{s.title}</span>
            <span className="kimchi-do-next__detail">{s.detail}</span>
          </button>
        ))}
      </div>
      <KimchiDoNextStyles />
    </div>
  );
}

export function KimchiDoNextCollapsedStyles() {
  return (
    <style>{`
      .kimchi-do-next-collapsed {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        margin: 0;
        padding: 8px 14px;
        border: none;
        border-bottom: 1px solid rgba(26, 58, 47, 0.08);
        background: rgba(26, 58, 47, 0.03);
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        color: rgba(26, 58, 47, 0.72);
        cursor: pointer;
      }
      .kimchi-do-next-collapsed__chev {
        color: rgba(26, 58, 47, 0.5);
        font-weight: 500;
      }
    `}</style>
  );
}

function KimchiDoNextStyles() {
  return (
    <style>{`
      .kimchi-do-next {
        flex-shrink: 0;
        padding: 12px 18px 10px;
        border-bottom: 1px solid rgba(26, 58, 47, 0.08);
        background: rgba(26, 58, 47, 0.02);
      }
      .kimchi-do-next__label {
        margin: 0 0 10px;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--scout-muted);
      }
      .kimchi-do-next__list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 180px;
        overflow-y: auto;
      }
      .kimchi-do-next__card {
        text-align: left;
        padding: 12px 14px;
        background: #fff;
        border: 1px solid rgba(26, 58, 47, 0.1);
        border-radius: var(--scout-radius);
        cursor: pointer;
      }
      .kimchi-do-next__card:hover {
        background: rgba(26, 58, 47, 0.03);
        border-color: rgba(26, 58, 47, 0.18);
      }
      .kimchi-do-next__title {
        display: block;
        font-family: ${sans};
        font-size: 15px;
        font-weight: 600;
        color: #1A3A2F;
      }
      .kimchi-do-next__detail {
        display: block;
        margin-top: 4px;
        font-family: ${sans};
        font-size: 13px;
        line-height: 1.4;
        color: var(--scout-muted);
      }
    `}</style>
  );
}

export function KimchiEmailInsightDrawer({
  open,
  activityId,
  inbox,
  pipelineJobs,
  onClose,
  onAskKimchi,
  onRefreshInbox,
}: {
  open: boolean;
  activityId: string | null;
  inbox: AssistantInboxSnapshot | null;
  pipelineJobs: Array<{ id: string; company: string; role: string; stage: string }>;
  onClose: () => void;
  onAskKimchi: (prompt: string) => void;
  onRefreshInbox: () => void;
}) {
  if (!open || !activityId) return null;

  const activity = inbox?.activities.find((a) => a.id === activityId);
  if (!activity) {
    return (
      <div className="kimchi-side-sheet-backdrop" onClick={onClose} role="presentation">
        <div className="kimchi-side-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
          <KimchiSideSheetHead title="Email insight" onClose={onClose} />
          <div className="kimchi-side-sheet__body">
            <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>
              Couldn&apos;t load this email — it may have been reviewed already.
            </p>
          </div>
          <KimchiSideSheetStyles />
        </div>
      </div>
    );
  }

  const headline = activity.title || activity.snippet || "Email about your search";
  const insightPrompt = `I got an email${activity.companyGuess ? ` from ${activity.companyGuess}` : ""}${activity.roleGuess ? ` about ${activity.roleGuess}` : ""}. Signal: ${activity.signal}. Snippet: "${(activity.snippet || activity.title || "").slice(0, 300)}". What should I do next?`;

  return (
    <div className="kimchi-side-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="kimchi-side-sheet kimchi-side-sheet--wide" onClick={(e) => e.stopPropagation()} role="dialog">
        <KimchiSideSheetHead title="Email insight" onClose={onClose} />
        <div className="kimchi-side-sheet__body">
          <p className="kimchi-email-insight__signal">{activity.signal.replace(/_/g, " ")}</p>
          <h3 className="kimchi-email-insight__headline">{headline}</h3>
          {activity.snippet && activity.snippet !== activity.title && (
            <p className="kimchi-email-insight__snippet">{activity.snippet}</p>
          )}
          {(activity.companyGuess || activity.roleGuess) && (
            <p className="kimchi-email-insight__guess">
              {activity.companyGuess && <span>{activity.companyGuess}</span>}
              {activity.roleGuess && <span>{activity.roleGuess}</span>}
            </p>
          )}
          <InboxInsightRow
            activity={activity}
            jobs={pipelineJobs}
            onAction={async (action, extra) => {
              const res = await fetch(`/api/user/job-agent/activity/${activity.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...extra }),
              });
              if (res.ok) {
                onRefreshInbox();
                onClose();
              }
            }}
            compact
          />
          <button
            type="button"
            className="kimchi-email-insight__ask"
            onClick={() => {
              onAskKimchi(insightPrompt);
              onClose();
            }}
          >
            Ask Kimchi what to do
          </button>
          <Link href="/inbox" className="kimchi-email-insight__link" onClick={onClose}>
            Open full inbox →
          </Link>
        </div>
        <KimchiSideSheetStyles />
      </div>
    </div>
  );
}

export function KimchiSaveIntakeModal({
  open,
  excerpt,
  presetTitle,
  onClose,
  onGenerateStrategy,
}: {
  open: boolean;
  excerpt: string;
  presetTitle: string;
  onClose: () => void;
  onGenerateStrategy: () => void;
}) {
  if (!open) return null;

  return (
    <div className="kimchi-modal-backdrop" onClick={onClose} role="presentation">
      <div className="kimchi-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <KimchiModalHead title="Added to career strategy intake" onClose={onClose} />
        <div className="kimchi-modal__body">
          <p style={{ fontFamily: sans, fontSize: 14, margin: "0 0 10px", lineHeight: 1.5 }}>
            Saved your <strong>{presetTitle}</strong> conversation to intake notes on Profile → Career Strategy.
            Kimchi uses this when building your strategy doc.
          </p>
          <div className="kimchi-intake-preview">
            <p className="kimchi-intake-preview__label">What we saved</p>
            <pre>{excerpt}</pre>
          </div>
          <div className="kimchi-modal__actions">
            <button type="button" className="kimchi-modal__primary" onClick={onGenerateStrategy}>
              Build career strategy doc
            </button>
            <Link href="/profile/career-strategy" className="kimchi-modal__secondary" onClick={onClose}>
              View on Profile
            </Link>
          </div>
        </div>
        <KimchiModalStyles />
      </div>
    </div>
  );
}

export function KimchiStrategyGenerateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError(null);
      setSummary(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setStatus("running");
      setError(null);
      try {
        const post = await fetch("/api/ai/career-strategy", { method: "POST" });
        const postData = await post.json().catch(() => ({}));
        if (post.status === 402) {
          setError("You need strategy credits — upgrade or check your balance.");
          setStatus("error");
          return;
        }
        if (!post.ok && post.status !== 202) {
          if (post.status === 403 || post.status === 503) {
            setError("Open Profile → Career Strategy to generate your doc from intake notes.");
            setStatus("error");
            return;
          }
          setError(typeof postData.error === "string" ? postData.error : "Could not start generation.");
          setStatus("error");
          return;
        }

        const poll = async (): Promise<void> => {
          if (cancelled) return;
          const res = await fetch("/api/ai/career-strategy");
          const data = await res.json().catch(() => ({}));
          if (data.generationStatus === "running") {
            await new Promise((r) => setTimeout(r, 2500));
            return poll();
          }
          if (data.generationStatus === "failed") {
            setError(data.generationError || "Generation failed.");
            setStatus("error");
            return;
          }
          if (data.hasDocument && data.document?.executiveSummary) {
            setSummary(String(data.document.executiveSummary).slice(0, 500));
            setStatus("complete");
            return;
          }
          if (data.hasDocument) {
            setStatus("complete");
            return;
          }
          setError("Generation finished but no document yet — check Profile.");
          setStatus("error");
        };

        await poll();
      } catch {
        if (!cancelled) {
          setError("Something went wrong.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="kimchi-modal-backdrop" onClick={onClose} role="presentation">
      <div className="kimchi-modal kimchi-modal--tall" onClick={(e) => e.stopPropagation()} role="dialog">
        <KimchiModalHead title="Career strategy doc" onClose={onClose} />
        <div className="kimchi-modal__body">
          {status === "running" && (
            <>
              <KimchiProcessLoader title="Building your career strategy…" hint="This uses your intake notes and profile." />
            </>
          )}
          {status === "complete" && (
            <>
              <p style={{ fontFamily: sans, fontSize: 14, margin: "0 0 10px", lineHeight: 1.5 }}>
                Your career strategy doc is ready.
              </p>
              {summary && (
                <div className="kimchi-intake-preview">
                  <p className="kimchi-intake-preview__label">Executive summary</p>
                  <pre>{summary}</pre>
                </div>
              )}
              <Link href="/profile/career-strategy" className="kimchi-modal__primary kimchi-modal__primary--link" onClick={onClose}>
                View full strategy on Profile
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <p style={{ fontFamily: sans, fontSize: 14, color: "#9B3A2A", margin: "0 0 12px" }}>{error}</p>
              <Link href="/profile/career-strategy" className="kimchi-modal__secondary" onClick={onClose}>
                Go to Career Strategy →
              </Link>
            </>
          )}
        </div>
        <KimchiModalStyles />
      </div>
    </div>
  );
}

function KimchiSideSheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="kimchi-side-sheet__head">
      <h2>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function KimchiModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="kimchi-modal__head">
      <h2>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

/** @deprecated use KimchiEmailInsightDrawer */
export function KimchiInboxPeekModal({
  open,
  inbox,
  onClose,
}: {
  open: boolean;
  inbox: AssistantInboxSnapshot | null;
  onClose: () => void;
}) {
  const firstId = inbox?.activities[0]?.id ?? null;
  return (
    <KimchiEmailInsightDrawer
      open={open}
      activityId={firstId}
      inbox={inbox}
      pipelineJobs={[]}
      onClose={onClose}
      onAskKimchi={() => {}}
      onRefreshInbox={() => {}}
    />
  );
}

export function KimchiTranscriptModal({
  open,
  title,
  transcript,
  onClose,
}: {
  open: boolean;
  title: string;
  transcript: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="kimchi-modal-backdrop" onClick={onClose} role="presentation">
      <div className="kimchi-modal kimchi-modal--tall" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="kimchi-modal__head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="kimchi-modal__body kimchi-modal__body--mono">
          <pre>{transcript}</pre>
        </div>
        <KimchiModalStyles />
      </div>
    </div>
  );
}

function KimchiSideSheetStyles() {
  return (
    <style>{`
      .kimchi-side-sheet-backdrop {
        position: absolute;
        inset: 0;
        z-index: 10;
        background: rgba(15, 24, 20, 0.25);
        display: flex;
        justify-content: flex-end;
      }
      .kimchi-side-sheet {
        width: min(100%, 420px);
        height: 100%;
        background: #fff;
        border-left: 1px solid rgba(26, 58, 47, 0.12);
        display: flex;
        flex-direction: column;
        box-shadow: -4px 0 24px rgba(0,0,0,0.08);
      }
      .kimchi-side-sheet--wide { width: min(100%, 480px); }
      .kimchi-side-sheet__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: #1A3A2F;
        color: #E8D5A3;
        flex-shrink: 0;
      }
      .kimchi-side-sheet__head h2 {
        margin: 0;
        font-family: ${sans};
        font-size: 14px;
        font-weight: 600;
      }
      .kimchi-side-sheet__head button {
        background: none;
        border: none;
        color: rgba(232, 213, 163, 0.75);
        font-size: 22px;
        cursor: pointer;
      }
      .kimchi-side-sheet__body {
        padding: 14px;
        overflow-y: auto;
        flex: 1;
      }
      .kimchi-email-insight__signal {
        margin: 0 0 6px;
        font-family: ${sans};
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--scout-muted);
      }
      .kimchi-email-insight__headline {
        margin: 0 0 8px;
        font-family: ${sans};
        font-size: 16px;
        font-weight: 600;
        color: #1A3A2F;
        line-height: 1.35;
      }
      .kimchi-email-insight__snippet {
        margin: 0 0 10px;
        font-family: ${sans};
        font-size: 13px;
        line-height: 1.5;
        color: #1A1A1A;
      }
      .kimchi-email-insight__guess {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 0 0 14px;
        font-family: ${sans};
        font-size: 12px;
        color: var(--scout-muted);
      }
      .kimchi-email-insight__ask {
        display: block;
        width: 100%;
        margin-top: 12px;
        padding: 10px 12px;
        background: #1A3A2F;
        color: #E8D5A3;
        border: none;
        border-radius: var(--scout-radius);
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .kimchi-email-insight__link {
        display: inline-block;
        margin-top: 10px;
        font-family: ${sans};
        font-size: 12px;
        color: #1A3A2F;
      }
      .kimchi-intake-preview {
        margin: 0 0 14px;
        padding: 10px 12px;
        background: rgba(26, 58, 47, 0.04);
        border: 1px solid rgba(26, 58, 47, 0.1);
        border-radius: var(--scout-radius);
        max-height: 160px;
        overflow-y: auto;
      }
      .kimchi-intake-preview__label {
        margin: 0 0 6px;
        font-family: ${sans};
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--scout-muted);
      }
      .kimchi-intake-preview pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: ${sans};
        font-size: 12px;
        line-height: 1.45;
        color: #1A1A1A;
      }
      .kimchi-modal__actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .kimchi-modal__primary {
        padding: 10px 14px;
        background: #1A3A2F;
        color: #E8D5A3;
        border: none;
        border-radius: var(--scout-radius);
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
      }
      .kimchi-modal__primary--link { display: block; }
      .kimchi-modal__secondary {
        display: block;
        text-align: center;
        font-family: ${sans};
        font-size: 13px;
        color: #1A3A2F;
      }
    `}</style>
  );
}

function KimchiModalStyles() {
  return (
    <style>{`
      .kimchi-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(15, 24, 20, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .kimchi-modal {
        width: min(440px, 100%);
        max-height: min(520px, 85vh);
        background: #fff;
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        box-shadow: 0 20px 50px rgba(26, 58, 47, 0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .kimchi-modal--tall {
        max-height: min(640px, 90vh);
      }
      .kimchi-modal__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: #1A3A2F;
        color: #E8D5A3;
      }
      .kimchi-modal__head h2 {
        margin: 0;
        font-family: ${sans};
        font-size: 14px;
        font-weight: 600;
      }
      .kimchi-modal__head button {
        background: none;
        border: none;
        color: rgba(232, 213, 163, 0.75);
        font-size: 22px;
        cursor: pointer;
        line-height: 1;
      }
      .kimchi-modal__body {
        padding: 14px;
        overflow-y: auto;
        flex: 1;
      }
      .kimchi-modal__body--mono pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: ${sans};
        font-size: 13px;
        line-height: 1.5;
        color: #1A1A1A;
      }
      .kimchi-modal__row {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      .kimchi-modal__row strong {
        font-family: ${sans};
        font-size: 13px;
        color: #1A3A2F;
      }
      .kimchi-modal__row p {
        margin: 4px 0 0;
        font-family: ${sans};
        font-size: 13px;
        line-height: 1.45;
        color: var(--scout-muted);
      }
    `}</style>
  );
}
