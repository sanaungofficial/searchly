"use client";

import type { ThreadSummary } from "@/hooks/use-kimchi-threads";
import { fontSans } from "@/lib/typography";

const sans = fontSans;

function formatThreadTitle(title: string): string {
  if (title === "New chat" || title === "New thread") return "New thread";
  return title;
}

function formatThreadDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function KimchiThreadSidebar({
  threads,
  activeThreadId,
  loading,
  onSelect,
  onCreate,
}: {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  loading?: boolean;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="kimchi-thread-sidebar" aria-label="Chat threads">
      <div className="kimchi-thread-sidebar__head">
        <span className="kimchi-thread-sidebar__label">Threads</span>
        <button
          type="button"
          className="kimchi-thread-sidebar__new"
          onClick={() => void onCreate()}
          aria-label="New thread"
          title="New thread"
        >
          +
        </button>
      </div>
      <div className="kimchi-thread-sidebar__list">
        {loading && threads.length === 0 ? (
          <p className="kimchi-thread-sidebar__empty">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="kimchi-thread-sidebar__empty">No threads yet — start one with +</p>
        ) : (
          threads.map((t) => {
            const active = t.id === activeThreadId;
            return (
              <button
                key={t.id}
                type="button"
                className={`kimchi-thread-sidebar__item${active ? " kimchi-thread-sidebar__item--active" : ""}`}
                onClick={() => void onSelect(t.id)}
              >
                <span className="kimchi-thread-sidebar__item-title">{formatThreadTitle(t.title)}</span>
                <span className="kimchi-thread-sidebar__item-meta">
                  {t.messageCount} msg · {formatThreadDate(t.updatedAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
      <KimchiThreadSidebarStyles />
    </aside>
  );
}

function KimchiThreadSidebarStyles() {
  return (
    <style>{`
      .kimchi-thread-sidebar {
        flex-shrink: 0;
        width: 240px;
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--scout-surface);
        border-left: var(--scout-border);
      }
      .kimchi-thread-sidebar__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 14px;
        border-bottom: var(--scout-border);
        flex-shrink: 0;
      }
      .kimchi-thread-sidebar__label {
        font-family: ${sans};
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.45);
      }
      .kimchi-thread-sidebar__new {
        width: 30px;
        height: 30px;
        padding: 0;
        border: var(--scout-border);
        border-radius: 0;
        background: var(--scout-page);
        color: #1A3A2F;
        font-family: ${sans};
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }
      .kimchi-thread-sidebar__new:hover {
        background: rgba(232, 213, 163, 0.35);
      }
      .kimchi-thread-sidebar__list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 8px;
      }
      .kimchi-thread-sidebar__empty {
        margin: 0;
        padding: 12px 8px;
        font-family: ${sans};
        font-size: 12px;
        line-height: 1.45;
        color: var(--scout-muted);
      }
      .kimchi-thread-sidebar__item {
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px 10px;
        margin-bottom: 4px;
        border: 1px solid transparent;
        border-radius: 0;
        background: transparent;
        cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      .kimchi-thread-sidebar__item:hover {
        background: rgba(26, 58, 47, 0.04);
        border-color: rgba(22, 22, 22, 0.12);
      }
      .kimchi-thread-sidebar__item--active {
        background: rgba(232, 213, 163, 0.35);
        border: var(--scout-border);
      }
      .kimchi-thread-sidebar__item-title {
        display: block;
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        color: #1A3A2F;
        line-height: 1.35;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .kimchi-thread-sidebar__item-meta {
        display: block;
        margin-top: 3px;
        font-family: ${sans};
        font-size: 10px;
        color: rgba(26, 58, 47, 0.48);
      }
      @media (max-width: 767px) {
        .kimchi-thread-sidebar {
          width: 112px;
        }
        .kimchi-thread-sidebar__head {
          padding: 10px 8px;
        }
        .kimchi-thread-sidebar__label {
          font-size: 9px;
        }
        .kimchi-thread-sidebar__list {
          padding: 6px 4px;
        }
        .kimchi-thread-sidebar__item {
          padding: 8px 6px;
        }
        .kimchi-thread-sidebar__item-title {
          font-size: 11px;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .kimchi-thread-sidebar__item-meta {
          font-size: 9px;
        }
      }
    `}</style>
  );
}
