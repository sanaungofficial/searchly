"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AssistantChip, KnowsYouPreview } from "@/lib/kimchi-assistant/chat-chips";
import type { AssistantSuggestion, AssistantInboxSnapshot } from "@/lib/kimchi-assistant/types";
import { InboxInsightRow } from "@/components/scout/inbox/inbox-insight-row";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { fontSans } from "@/lib/typography";

const sans = fontSans;

export function KimchiAssistantChipRow({
  chips,
  label,
  onActivate,
  layout = "inline",
  emphasis,
}: {
  chips: AssistantChip[];
  label?: string;
  onActivate: (chip: AssistantChip) => void;
  /** inline = compact pills in a row (default); stack = deprecated full-width rows */
  layout?: "stack" | "inline";
  /** cta = solid colorful action buttons (Strut-style) */
  emphasis?: "default" | "cta";
}) {
  if (chips.length === 0) return null;

  const inline = layout !== "stack";
  const cta = emphasis === "cta";

  return (
    <div className={`kimchi-chips${inline ? " kimchi-chips--inline" : ""}${cta ? " kimchi-chips--cta" : ""}`}>
      {label && <p className="kimchi-chips__label">{label}</p>}
      <div className="kimchi-chips__row">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`kimchi-chips__chip kimchi-chips__chip--${chip.variant}${chip.tone ? ` kimchi-chips__chip--tone-${chip.tone}` : ""}${cta && chip.variant === "action" ? " kimchi-chips__chip--solid" : ""}`}
            title={chip.hint ?? chip.label}
            onClick={() => onActivate(chip)}
          >
            {!inline && chip.variant === "action" && (
              <span className="kimchi-chips__arrow" aria-hidden="true">→</span>
            )}
            {inline && chip.variant === "action" && !cta && (
              <span className="kimchi-chips__pill-dot" aria-hidden="true" />
            )}
            <span className="kimchi-chips__chip-label">{chip.label}</span>
          </button>
        ))}
      </div>
      <KimchiChipStyles />
    </div>
  );
}

/** iMessage-style typing indicator while Kimchi is composing */
export function KimchiTypingIndicator() {
  return (
    <span className="kimchi-typing" aria-live="polite" aria-label="Kimchi is typing">
      <span className="kimchi-typing__dot" />
      <span className="kimchi-typing__dot" />
      <span className="kimchi-typing__dot" />
      <KimchiTypingStyles />
    </span>
  );
}

export function KimchiCopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className={`kimchi-copy-btn${className ? ` ${className}` : ""}`}
      onClick={() => void onCopy()}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied!" : label}
    >
      {copied ? (
        <span className="kimchi-copy-btn__check" aria-hidden="true">
          ✓
        </span>
      ) : (
        <svg
          className="kimchi-copy-btn__icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      )}
      <KimchiCopyButtonStyles />
    </button>
  );
}

function KimchiCopyButtonStyles() {
  return (
    <style>{`
      .kimchi-copy-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 1px solid rgba(26, 58, 47, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.9);
        color: rgba(26, 58, 47, 0.55);
        cursor: pointer;
        flex-shrink: 0;
        transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
      }
      .kimchi-copy-btn:hover {
        color: #1A3A2F;
        border-color: rgba(26, 58, 47, 0.22);
        background: #fff;
      }
      .kimchi-copy-btn__check {
        font-size: 13px;
        font-weight: 700;
        color: #2d9a6a;
      }
      .kimchi-copy-btn__icon {
        display: block;
      }
    `}</style>
  );
}

function KimchiTypingStyles() {
  return (
    <style>{`
      .kimchi-typing {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-width: 36px;
        min-height: 12px;
      }
      .kimchi-typing__dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgba(26, 58, 47, 0.38);
        animation: kimchi-typing-bounce 1.2s ease-in-out infinite;
      }
      .kimchi-typing__dot:nth-child(1) { animation-delay: 0s; }
      .kimchi-typing__dot:nth-child(2) { animation-delay: 0.15s; }
      .kimchi-typing__dot:nth-child(3) { animation-delay: 0.3s; }
      @keyframes kimchi-typing-bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
        30% { transform: translateY(-5px); opacity: 1; }
      }
    `}</style>
  );
}

/** @deprecated use KimchiAssistantChipRow */
export function KimchiChipRow({
  chips,
  label,
  onSelect,
}: {
  chips: Array<{ id: string; label: string; prompt: string }>;
  label?: string;
  onSelect: (prompt: string) => void;
}) {
  return (
    <KimchiAssistantChipRow
      label={label}
      chips={chips.map((c) => ({
        id: c.id,
        label: c.label,
        variant: "chat" as const,
        action: { type: "chat" as const, prompt: c.prompt },
      }))}
      onActivate={(chip) => {
        if (chip.action.type === "chat") onSelect(chip.action.prompt);
      }}
    />
  );
}

export function KimchiStarterSection({
  actions,
  chatChips,
  knowsYou,
  onActivate,
}: {
  actions: AssistantChip[];
  chatChips: AssistantChip[];
  knowsYou?: KnowsYouPreview | null;
  onActivate: (chip: AssistantChip) => void;
}) {
  const chips = [...actions, ...chatChips].filter(
    (chip, index, list) => list.findIndex((c) => c.id === chip.id) === index,
  );

  return (
    <div className="kimchi-starter">
      {knowsYou && (
        <div className="kimchi-knows-you">
          <p className="kimchi-knows-you__label">Kimchi knows you</p>
          <p className="kimchi-knows-you__headline">{knowsYou.headline}</p>
          {knowsYou.details.map((detail) => (
            <p key={detail} className="kimchi-knows-you__detail">
              {detail}
            </p>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <KimchiAssistantChipRow chips={chips} layout="inline" emphasis="cta" onActivate={onActivate} />
      )}
      <KimchiStarterStyles />
    </div>
  );
}

function KimchiStarterStyles() {
  return (
    <style>{`
      .kimchi-starter {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 8px;
      }
      .kimchi-knows-you {
        margin: 0 0 10px;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(124, 92, 191, 0.08) 0%, rgba(45, 154, 106, 0.08) 100%);
        border: 1px solid rgba(26, 58, 47, 0.1);
        border-radius: 10px;
      }
      .kimchi-knows-you__label {
        margin: 0 0 4px;
        font-family: ${sans};
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.48);
      }
      .kimchi-knows-you__headline {
        margin: 0 0 4px;
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
        color: #1A3A2F;
      }
      .kimchi-knows-you__detail {
        margin: 0;
        font-family: ${sans};
        font-size: 12px;
        line-height: 1.4;
        color: rgba(26, 58, 47, 0.72);
      }
      .kimchi-knows-you__detail + .kimchi-knows-you__detail {
        margin-top: 2px;
      }
    `}</style>
  );
}

function KimchiChipStyles() {
  return (
    <style>{`
      .kimchi-chips {
        margin: 0 0 8px;
      }
      .kimchi-chips__label {
        margin: 0 0 4px;
        font-family: ${sans};
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.42);
      }
      .kimchi-chips__row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .kimchi-chips__chip {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        border-radius: var(--scout-radius);
        font-family: ${sans};
        cursor: pointer;
        text-align: left;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
      }
      .kimchi-chips__chip--chat {
        background: #fff;
        border: 1.5px solid rgba(26, 58, 47, 0.14);
        color: #1A3A2F;
      }
      .kimchi-chips__chip--chat:hover {
        background: rgba(26, 58, 47, 0.04);
        border-color: rgba(26, 58, 47, 0.24);
      }
      .kimchi-chips__chip--action {
        background: rgba(26, 58, 47, 0.06);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        color: #1A3A2F;
      }
      .kimchi-chips__chip--action:hover {
        background: rgba(26, 58, 47, 0.1);
        border-color: rgba(26, 58, 47, 0.22);
      }
      .kimchi-chips__arrow {
        flex-shrink: 0;
        margin-top: 2px;
        font-size: 14px;
        font-weight: 700;
        color: #1A3A2F;
      }
      .kimchi-chips__chip-label {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.35;
      }
      .kimchi-chips--inline {
        margin-bottom: 6px;
      }
      .kimchi-chips--inline .kimchi-chips__label {
        margin-bottom: 3px;
      }
      .kimchi-chips--inline .kimchi-chips__row {
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 5px;
        overflow-x: auto;
        padding-bottom: 2px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .kimchi-chips--inline .kimchi-chips__row::-webkit-scrollbar {
        display: none;
      }
      .kimchi-chips--inline .kimchi-chips__chip {
        flex-shrink: 0;
        width: auto;
        max-width: 168px;
        padding: 5px 10px;
        align-items: center;
        gap: 5px;
        border-radius: 8px;
        border-width: 1px;
      }
      .kimchi-chips--inline .kimchi-chips__chip:active {
        transform: scale(0.97);
      }
      .kimchi-chips--inline .kimchi-chips__chip-label {
        font-size: 11px;
        font-weight: 500;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kimchi-chips--inline .kimchi-chips__chip--chat {
        background: #fff;
        border-color: rgba(26, 58, 47, 0.16);
      }
      .kimchi-chips--inline .kimchi-chips__chip--action {
        background: rgba(26, 58, 47, 0.07);
        border-color: rgba(26, 58, 47, 0.14);
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-violet {
        background: #f3ecff;
        border-color: #c4a8e8;
        color: #4a2d7a;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-violet .kimchi-chips__pill-dot {
        background: #7c5cbf;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-sky {
        background: #e8f4ff;
        border-color: #9ec5ef;
        color: #1a4a6e;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-sky .kimchi-chips__pill-dot {
        background: #3b82c4;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-amber {
        background: #fff8e6;
        border-color: #e8c96a;
        color: #6b4f00;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-amber .kimchi-chips__pill-dot {
        background: #c9920a;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-mint {
        background: #e8f7f0;
        border-color: #8fd4b0;
        color: #1a4a35;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-rose {
        background: #fff0f3;
        border-color: #f0b8c4;
        color: #6b2438;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-neutral {
        background: #f5f5f4;
        border-color: rgba(26, 58, 47, 0.18);
        color: #1A3A2F;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-violet:hover {
        background: #ebe0ff;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-sky:hover {
        background: #dcebff;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-amber:hover {
        background: #fff3cc;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-mint:hover {
        background: #d8f0e4;
      }
      .kimchi-chips--inline .kimchi-chips__chip--tone-rose:hover {
        background: #ffe4ea;
      }
      .kimchi-chips--cta .kimchi-chips__row {
        flex-wrap: wrap;
        gap: 8px;
      }
      .kimchi-chips--cta .kimchi-chips__chip {
        max-width: none;
        padding: 8px 14px;
        border-radius: 10px;
        font-weight: 600;
      }
      .kimchi-chips--cta .kimchi-chips__chip-label {
        font-size: 13px;
        font-weight: 600;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid.kimchi-chips__chip--action {
        background: #e8913a;
        border-color: #d47a22;
        color: #fff;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid.kimchi-chips__chip--tone-violet {
        background: #7c5cbf;
        border-color: #6b4aad;
        color: #fff;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid.kimchi-chips__chip--tone-sky {
        background: #3b82c4;
        border-color: #2f6da8;
        color: #fff;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid.kimchi-chips__chip--tone-amber {
        background: #e8913a;
        border-color: #d47a22;
        color: #fff;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid.kimchi-chips__chip--tone-mint {
        background: #2d9a6a;
        border-color: #248558;
        color: #fff;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid.kimchi-chips__chip--tone-rose {
        background: #d45d7a;
        border-color: #bf4d68;
        color: #fff;
      }
      .kimchi-chips--cta .kimchi-chips__chip--solid:hover {
        filter: brightness(1.06);
        transform: translateY(-1px);
      }
      .kimchi-chips--cta .kimchi-chips__chip--chat {
        background: #fff;
        border-color: rgba(26, 58, 47, 0.18);
        box-shadow: 0 1px 2px rgba(17, 17, 17, 0.04);
      }
      .kimchi-chips__pill-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #1A3A2F;
        flex-shrink: 0;
        opacity: 0.55;
      }
    `}</style>
  );
}

type DoNextProps = {
  suggestions: AssistantChip[];
  onActivate: (chip: AssistantChip) => void;
  onGenerate?: () => void;
  generating?: boolean;
  visible?: boolean;
};

export function KimchiSuggestionsBar({
  chips,
  onActivate,
  onGenerate,
  generating,
  visible,
}: DoNextProps) {
  if (!visible && chips.length === 0) {
    if (!onGenerate) return null;
    return (
      <div className="kimchi-suggestions-bar">
        <button
          type="button"
          className="kimchi-suggest-trigger"
          disabled={generating}
          onClick={onGenerate}
        >
          {generating ? "Loading…" : "✦ Show suggestions"}
        </button>
        <KimchiSuggestionsBarStyles />
      </div>
    );
  }

  if (chips.length === 0) return null;

  return (
    <div className="kimchi-suggestions-bar">
      <KimchiAssistantChipRow
        chips={chips}
        onActivate={onActivate}
        layout="inline"
        emphasis="cta"
      />
      <KimchiSuggestionsBarStyles />
    </div>
  );
}

/** @deprecated use KimchiSuggestionsBar */
export function KimchiDoNextStrip({
  suggestions,
  onSelect,
}: {
  suggestions: AssistantSuggestion[];
  onSelect: (s: AssistantSuggestion) => void;
}) {
  const chips = suggestions.map((s) => ({
    id: s.id,
    label: s.title,
    hint: s.detail,
    variant: "chat" as const,
    action: {
      type: "chat" as const,
      prompt: s.detail ? `${s.title} — ${s.detail}` : s.title,
    },
  }));

  return (
    <KimchiSuggestionsBar
      chips={chips}
      visible
      onActivate={(chip) => {
        const s = suggestions.find((x) => x.id === chip.id);
        if (s) onSelect(s);
      }}
    />
  );
}

function KimchiSuggestionsBarStyles() {
  return (
    <style>{`
      .kimchi-suggestions-bar {
        flex-shrink: 0;
        padding: 8px 16px 4px;
        border-top: 1px solid rgba(26, 58, 47, 0.06);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 248, 235, 0.5) 100%);
      }
      .kimchi-suggest-trigger {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border: 1px solid rgba(26, 58, 47, 0.14);
        border-radius: 10px;
        background: #fff;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        color: rgba(26, 58, 47, 0.72);
        cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      .kimchi-suggest-trigger:hover:not(:disabled) {
        background: rgba(26, 58, 47, 0.04);
        border-color: rgba(26, 58, 47, 0.22);
        color: #1A3A2F;
      }
      .kimchi-suggest-trigger:disabled {
        opacity: 0.6;
        cursor: wait;
      }
    `}</style>
  );
}

function KimchiDoNextStyles() {
  return (
    <style>{`
      .kimchi-do-next {
        flex-shrink: 0;
        padding: 10px 18px 8px;
        border-bottom: 1px solid rgba(26, 58, 47, 0.06);
        background: linear-gradient(180deg, rgba(255, 248, 235, 0.65) 0%, rgba(255, 255, 255, 0) 100%);
      }
      .kimchi-do-next__head {
        margin-bottom: 4px;
      }
      .kimchi-do-next__label {
        margin: 0;
        font-family: ${sans};
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.42);
      }
      .kimchi-do-next__row {
        display: flex;
        flex-wrap: nowrap;
        gap: 5px;
        overflow-x: auto;
        padding-bottom: 1px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .kimchi-do-next__row::-webkit-scrollbar {
        display: none;
      }
      .kimchi-do-next__pill {
        flex-shrink: 0;
        max-width: 180px;
        padding: 6px 12px;
        background: #fff;
        border: 1px solid rgba(26, 58, 47, 0.12);
        border-radius: 10px;
        cursor: pointer;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        color: #1A3A2F;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: background 0.12s ease, transform 0.1s ease, box-shadow 0.12s ease;
        box-shadow: 0 1px 2px rgba(17, 17, 17, 0.04);
      }
      .kimchi-do-next__pill:nth-child(3n+1) {
        background: #f3ecff;
        border-color: #c4a8e8;
        color: #4a2d7a;
      }
      .kimchi-do-next__pill:nth-child(3n+2) {
        background: #e8f4ff;
        border-color: #9ec5ef;
        color: #1a4a6e;
      }
      .kimchi-do-next__pill:nth-child(3n) {
        background: #fff8e6;
        border-color: #e8c96a;
        color: #6b4f00;
      }
      .kimchi-do-next__pill:hover {
        background: rgba(26, 58, 47, 0.05);
        border-color: rgba(26, 58, 47, 0.22);
      }
      .kimchi-do-next__pill:active {
        transform: scale(0.97);
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
