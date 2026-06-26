"use client";

import type { AssistantSuggestion, AssistantInboxSnapshot } from "@/lib/kimchi-assistant/types";
import { fontSans } from "@/lib/typography";

const sans = fontSans;

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
        padding: 10px 14px 8px;
        border-bottom: 1px solid rgba(26, 58, 47, 0.08);
        background: rgba(26, 58, 47, 0.02);
      }
      .kimchi-do-next__label {
        margin: 0 0 8px;
        font-family: ${sans};
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--scout-muted);
      }
      .kimchi-do-next__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 140px;
        overflow-y: auto;
      }
      .kimchi-do-next__card {
        text-align: left;
        padding: 8px 10px;
        background: #fff;
        border: 1px solid rgba(26, 58, 47, 0.1);
        border-radius: var(--scout-radius);
        cursor: pointer;
      }
      .kimchi-do-next__title {
        display: block;
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        color: #1A3A2F;
      }
      .kimchi-do-next__detail {
        display: block;
        margin-top: 2px;
        font-family: ${sans};
        font-size: 12px;
        line-height: 1.35;
        color: var(--scout-muted);
      }
    `}</style>
  );
}

export function KimchiInboxPeekModal({
  open,
  inbox,
  onClose,
}: {
  open: boolean;
  inbox: AssistantInboxSnapshot | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="kimchi-modal-backdrop" onClick={onClose} role="presentation">
      <div className="kimchi-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="inbox-peek-title">
        <div className="kimchi-modal__head">
          <h2 id="inbox-peek-title">Email updates</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="kimchi-modal__body">
          {!inbox || (inbox.activities.length === 0 && inbox.followUps.length === 0) ? (
            <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>
              Nothing waiting right now. Connect email under Inbox if you haven&apos;t yet.
            </p>
          ) : (
            <>
              {inbox.activities.map((a) => (
                <div key={a.id} className="kimchi-modal__row">
                  <strong>{a.companyGuess || a.roleGuess || "Email"}</strong>
                  <p>{a.title || a.snippet}</p>
                </div>
              ))}
              {inbox.followUps.map((f) => (
                <div key={f.jobId} className="kimchi-modal__row">
                  <strong>{f.role} · {f.company}</strong>
                  <p>{f.suggestion}</p>
                </div>
              ))}
            </>
          )}
        </div>
        <KimchiModalStyles />
      </div>
    </div>
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
