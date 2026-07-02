"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import { color, fontSans, surface, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

const DRAWER_WIDTH = 560;

export type SuggestFromInboxRow = {
  contactId: string;
  email: string;
  name: string;
  company: string | null;
  reason: string;
  score: number;
  lastActivityAt: string | null;
  activityPreview: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  scopePath: (path: string) => string;
  mailConnected: boolean;
  onAdded?: () => void;
};

export function SuggestFromInboxDrawer({ open, onClose, scopePath, mailConnected, onAdded }: Props) {
  const { isMobile, backdropStyle, panelStyle } = useWorkspaceDrawerLayout();

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestFromInboxRow[]>([]);
  const [inboxConnected, setInboxConnected] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notesByEmail, setNotesByEmail] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null,
  );
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    if (!mailConnected) {
      setInboxConnected(false);
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setFetchError(null);
    setActionNotice(null);
    try {
      const res = await fetch(scopePath("/api/user/inbox/contacts/suggest-from-inbox"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 30 }),
      });
      const data = (await res.json()) as {
        suggestions?: SuggestFromInboxRow[];
        inboxConnected?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load suggestions.");
      setInboxConnected(data.inboxConnected !== false);
      setSuggestions(data.suggestions ?? []);
      setSelected(new Set((data.suggestions ?? []).map((s) => s.email)));
      setNotesByEmail({});
      setAiMessage(null);
    } catch (e) {
      setSuggestions([]);
      setFetchError(e instanceof Error ? e.message : "Could not load suggestions.");
    } finally {
      setLoading(false);
    }
  }, [mailConnected, scopePath]);

  useEffect(() => {
    if (open) void loadSuggestions();
    else {
      setSelected(new Set());
      setNotesByEmail({});
      setActionNotice(null);
      setAiMessage(null);
    }
  }, [open, loadSuggestions]);

  const selectedRows = useMemo(
    () => suggestions.filter((s) => selected.has(s.email)),
    [suggestions, selected],
  );

  const allSelected = suggestions.length > 0 && selected.size === suggestions.length;

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(suggestions.map((s) => s.email)));
  }

  async function handleSummarize() {
    if (selectedRows.length === 0) return;
    setSummarizing(true);
    setActionNotice(null);
    setAiMessage(null);
    try {
      const res = await fetch(scopePath("/api/user/inbox/contacts/suggest-from-inbox/summarize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: selectedRows.map((r) => r.email) }),
      });
      const data = (await res.json()) as {
        summaries?: Record<string, string>;
        aiAvailable?: boolean;
        message?: string;
      };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not summarize.");

      if (data.message) setAiMessage(data.message);
      if (data.aiAvailable === false) {
        setActionNotice({
          type: "info",
          text: data.message ?? "AI summaries are available on production only.",
        });
        return;
      }

      const next = { ...notesByEmail };
      for (const row of selectedRows) {
        const summary = data.summaries?.[row.email.toLowerCase()];
        if (summary) next[row.email] = summary;
      }
      setNotesByEmail(next);

      const count = Object.keys(data.summaries ?? {}).length;
      if (count > 0) {
        setActionNotice({
          type: "success",
          text: `Generated context for ${count} contact${count === 1 ? "" : "s"}.`,
        });
      } else if (!data.message) {
        setActionNotice({ type: "info", text: "No summaries returned — try again." });
      }
    } catch (e) {
      setActionNotice({
        type: "error",
        text: e instanceof Error ? e.message : "Could not summarize.",
      });
    } finally {
      setSummarizing(false);
    }
  }

  async function handleAdd() {
    if (selectedRows.length === 0) return;
    setAdding(true);
    setActionNotice(null);

    try {
      const res = await fetch(scopePath("/api/user/inbox/contacts/suggest-from-inbox/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: selectedRows.map((row) => ({
            email: row.email,
            name: row.name,
            company: row.company,
            notes: notesByEmail[row.email] ?? notesByEmail[row.email.toLowerCase()] ?? null,
          })),
        }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add contacts.");

      const added = data.added ?? 0;
      setActionNotice({
        type: "success",
        text: `Added ${added} contact${added === 1 ? "" : "s"} to My Network.`,
      });
      onAdded?.();
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setActionNotice({
        type: "error",
        text: e instanceof Error ? e.message : "Could not add contacts.",
      });
    } finally {
      setAdding(false);
    }
  }

  if (!open) return null;

  const line = "var(--scout-border)";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          ...backdropStyle,
          background: "rgba(0,0,0,0.18)",
          zIndex: DRAWER_BACKDROP_Z,
        }}
      />
      <div
        style={{
          ...panelStyle,
          width: isMobile ? "100%" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100%" : "calc(100vw - 16px)",
          background: surface.inset,
          border: isMobile ? "none" : line,
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px 12px" : "18px 20px 14px",
            borderBottom: line,
            background: surface.card,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: "none",
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.forest,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ✕
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink }}>
                Suggest from inbox
              </p>
              <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.45 }}>
                People from recent mail and meetings worth adding to My Network.
              </p>
            </div>
          </div>
        </div>

        {actionNotice && (
          <div
            style={{
              padding: "10px 16px",
              fontFamily: fontSans,
              fontSize: T.caption,
              color:
                actionNotice.type === "success"
                  ? color.forest
                  : actionNotice.type === "error"
                    ? "#C4574A"
                    : color.muted,
              background:
                actionNotice.type === "success"
                  ? "rgba(42,107,74,0.08)"
                  : actionNotice.type === "error"
                    ? "rgba(196,87,74,0.08)"
                    : "rgba(0,0,0,0.03)",
              borderBottom: line,
            }}
          >
            {actionNotice.text}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {loading && (
            <p style={{ padding: 24, margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
              Scanning your inbox for contacts…
            </p>
          )}

          {!loading && !mailConnected && (
            <div style={{ padding: 24 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55 }}>
                Connect Gmail or Outlook from the Inbox tab first — Kimchi needs synced mail to suggest contacts.
              </p>
            </div>
          )}

          {!loading && mailConnected && !inboxConnected && (
            <div style={{ padding: 24 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55 }}>
                Inbox not connected. Connect mail from the Inbox tab, then try again.
              </p>
            </div>
          )}

          {!loading && fetchError && (
            <div style={{ padding: 24 }}>
              <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A" }}>{fetchError}</p>
              <ScoutSecondaryBtn onClick={() => void loadSuggestions()}>Retry</ScoutSecondaryBtn>
            </div>
          )}

          {!loading && !fetchError && mailConnected && inboxConnected && suggestions.length === 0 && (
            <div style={{ padding: 24 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
                No new suggestions right now. Sync mail from the Inbox tab or broaden your recent conversations — we
                only show people with real names (not info@ or noreply@).
              </p>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F5F5F5", borderBottom: line }}>
                  <th style={{ ...thStyle, width: 40 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                  </th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Company</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((row) => {
                  const checked = selected.has(row.email);
                  const note = notesByEmail[row.email] ?? notesByEmail[row.email.toLowerCase()];
                  return (
                    <tr key={row.contactId} style={{ borderBottom: line, background: checked ? "rgba(59,130,246,0.04)" : "#fff" }}>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(row.email)) next.delete(row.email);
                              else next.add(row.email);
                              return next;
                            });
                          }}
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                          {row.name}
                        </div>
                        <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                          {row.reason}
                        </div>
                        <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, marginTop: 2 }}>
                          {row.activityPreview}
                        </div>
                        {note && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              borderRadius: 6,
                              background: "rgba(42,107,74,0.06)",
                              fontFamily: fontSans,
                              fontSize: T.caption,
                              color: color.ink,
                              lineHeight: 1.45,
                            }}
                          >
                            {note}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, wordBreak: "break-all" }}>
                          {row.email}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: row.company ? color.ink : color.muted }}>
                          {row.company ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: line,
            background: "#FAFAFA",
            flexShrink: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, flex: 1, minWidth: 120 }}>
            {selected.size} selected
          </span>
          {aiMessage && (
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, width: "100%" }}>
              {aiMessage}
            </span>
          )}
          <ScoutSecondaryBtn
            onClick={() => void handleSummarize()}
            disabled={summarizing || adding || selected.size === 0}
          >
            {summarizing ? "Summarizing…" : "Get context summary"}
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn
            onClick={() => void handleAdd()}
            disabled={adding || summarizing || selected.size === 0}
          >
            {adding ? "Adding…" : "Add to My Network"}
          </ScoutPrimaryBtn>
        </div>
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 700,
  color: color.muted,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  verticalAlign: "top",
};
