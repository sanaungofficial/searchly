"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ComposeState, Folder, InboxStatus, MessageDetail, MessageSummary } from "./inbox-types";

function pickInboxFolder(folders: Folder[]): Folder | null {
  return (
    folders.find((f) => f.id === "INBOX" || f.name.toLowerCase() === "inbox" || f.name === "Inbox") ??
    folders[0] ??
    null
  );
}

async function readFetchError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

type Props = {
  mailRefreshKey?: number;
  status: InboxStatus;
  initialMessageId?: string | null;
  onInitialMessageConsumed?: () => void;
  onNotice: (n: { type: "success" | "error"; text: string } | null) => void;
  compose: ComposeState;
  onComposeChange: (c: ComposeState) => void;
  onSend: () => Promise<void>;
  sending: boolean;
};

export function InboxMailView({
  mailRefreshKey,
  status,
  initialMessageId,
  onInitialMessageConsumed,
  onNotice,
  compose,
  onComposeChange,
  onSend,
  sending,
}: Props) {
  const isMobile = useIsMobile();
  const { withClientScope } = useWorkspace();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [showThread, setShowThread] = useState(true);
  const [foldersReady, setFoldersReady] = useState(false);
  const connected = Boolean(status.connected);

  const loadFolders = useCallback(async () => {
    const res = await fetch(withClientScope("/api/user/email/folders"));
    if (!res.ok) throw new Error(await readFetchError(res, "folders"));
    const data = await res.json();
    return (data.folders ?? []) as Folder[];
  }, [withClientScope]);

  const loadMessages = useCallback(async (folderId: string | null, q: string, cursor?: string | null) => {
    const params = new URLSearchParams();
    if (folderId) params.set("folderId", folderId);
    if (q.trim()) params.set("q", q.trim());
    if (cursor) params.set("pageToken", cursor);
    const res = await fetch(withClientScope(`/api/user/email/messages?${params.toString()}`));
    if (!res.ok) throw new Error(await readFetchError(res, "messages"));
    const data = await res.json();
    return {
      messages: (data.messages ?? []) as MessageSummary[],
      nextCursor: (data.nextCursor as string | null) ?? null,
    };
  }, [withClientScope]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(withClientScope(`/api/user/email/messages/${encodeURIComponent(id)}?thread=1`));
    if (!res.ok) throw new Error(await readFetchError(res, "detail"));
    return res.json() as Promise<MessageDetail>;
  }, [withClientScope]);

  useEffect(() => {
    if (!connected) return;
    setFoldersReady(false);
    setFolders([]);
    setSelectedFolderId(null);
    setMessages([]);
    setSelectedId(null);
    setDetail(null);
    loadFolders()
      .then((f) => {
        setFolders(f);
        setSelectedFolderId(pickInboxFolder(f)?.id ?? null);
      })
      .catch((err) =>
        onNotice({
          type: "error",
          text: err instanceof Error && err.message !== "folders" ? err.message : "Could not load folders.",
        }),
      )
      .finally(() => setFoldersReady(true));
  }, [connected, loadFolders, onNotice, mailRefreshKey]);

  useEffect(() => {
    if (!connected || !foldersReady) return;
    setListLoading(true);
    const t = setTimeout(() => {
      loadMessages(selectedFolderId, search)
        .then(({ messages: rows, nextCursor: cursor }) => {
          setMessages(rows);
          setNextCursor(cursor);
        })
        .catch((err) =>
          onNotice({
            type: "error",
            text: err instanceof Error && err.message !== "messages" ? err.message : "Could not load messages.",
          }),
        )
        .finally(() => setListLoading(false));
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [connected, foldersReady, selectedFolderId, search, loadMessages, onNotice, mailRefreshKey]);

  useEffect(() => {
    if (messages.length === 0 || initialMessageId || selectedId) return;
    setSelectedId(messages[0].id);
  }, [messages, initialMessageId, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    loadDetail(selectedId)
      .then(setDetail)
      .catch(() => onNotice({ type: "error", text: "Could not open message." }))
      .finally(() => setDetailLoading(false));
  }, [selectedId, loadDetail, onNotice]);

  useEffect(() => {
    if (!initialMessageId) return;
    setSelectedId(initialMessageId);
    if (isMobile) setMobilePane("detail");
    onInitialMessageConsumed?.();
  }, [initialMessageId, isMobile, onInitialMessageConsumed]);

  function selectMessage(id: string) {
    setSelectedId(id);
    if (isMobile) setMobilePane("detail");
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { messages: rows, nextCursor: cursor } = await loadMessages(selectedFolderId, search, nextCursor);
      setMessages((prev) => [...prev, ...rows]);
      setNextCursor(cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function patchMessage(patch: { unread?: boolean; starred?: boolean; archive?: boolean }) {
    if (!selectedId) return;
    const res = await fetch(withClientScope(`/api/user/email/messages/${encodeURIComponent(selectedId)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      onNotice({ type: "error", text: "Could not update message." });
      return;
    }
    const data = await res.json();
    setMessages((prev) =>
      prev.map((m) => (m.id === selectedId ? { ...m, unread: data.message.unread, starred: data.message.starred } : m)),
    );
    if (detail) setDetail({ ...detail, unread: data.message.unread, starred: data.message.starred });
    if (patch.archive) {
      setSelectedId(null);
      setMessages((prev) => prev.filter((m) => m.id !== selectedId));
      onNotice({ type: "success", text: "Archived." });
    }
  }

  function openReply() {
    if (!detail) return;
    const reSubject = detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`;
    onComposeChange({
      open: true,
      to: detail.from.replace(/^.*<([^>]+)>.*$/, "$1").trim() || detail.from,
      subject: reSubject,
      body: `\n\n---\n${detail.bodyText.slice(0, 2000)}`,
      replyToMessageId: detail.id,
    });
  }

  const showList = !isMobile || mobilePane === "list";
  const showDetail = !isMobile || mobilePane === "detail";

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderBottom: border.line,
          background: surface.page,
        }}
      >
        {folders.length > 0 && (
          <select
            value={selectedFolderId ?? ""}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            aria-label="Mail folder"
            style={{
              flexShrink: 0,
              padding: "7px 10px",
              fontFamily: fontSans,
              fontSize: T.caption,
              border: border.line,
              borderRadius: "var(--scout-radius)",
              background: surface.card,
              maxWidth: 140,
            }}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.unread_count ? ` (${f.unread_count})` : ""}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          placeholder="Search mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "7px 10px",
            border: border.line,
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: T.caption,
            background: surface.card,
          }}
        />
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {showList && (
          <section
            style={{
              width: isMobile ? "100%" : "min(360px, 38%)",
              flexShrink: 0,
              borderRight: isMobile ? "none" : border.line,
              overflowY: "auto",
              background: surface.card,
            }}
          >
            {listLoading && (
              <p style={{ padding: 12, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading…</p>
            )}
            {!listLoading && messages.length === 0 && (
              <p style={{ padding: 12, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>No messages here.</p>
            )}
            {messages.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => selectMessage(msg.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: border.line,
                  background: msg.id === selectedId ? "rgba(26,58,47,0.06)" : msg.unread ? "rgba(26,58,47,0.03)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      fontWeight: msg.unread ? 700 : 500,
                      color: color.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {msg.starred ? "★ " : ""}
                    {msg.from}
                  </span>
                  <span style={{ fontFamily: fontMono, fontSize: 10, color: color.muted, flexShrink: 0 }}>{msg.dateLabel}</span>
                </div>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    fontWeight: 600,
                    color: color.forest,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {msg.subject}
                  {(msg.attachmentCount ?? 0) > 0 ? ` 📎${msg.attachmentCount}` : ""}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    color: color.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {msg.snippet}
                </p>
              </button>
            ))}
            {nextCursor && (
              <div style={{ padding: 12, textAlign: "center" }}>
                <ScoutSecondaryBtn onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </ScoutSecondaryBtn>
              </div>
            )}
          </section>
        )}

        {showDetail && (
          <section style={{ flex: 1, minWidth: 0, overflowY: "auto", background: surface.card }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobilePane("list")}
                style={{
                  padding: "10px 14px",
                  border: "none",
                  borderBottom: border.line,
                  background: surface.page,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  cursor: "pointer",
                  color: color.forest,
                  width: "100%",
                  textAlign: "left",
                }}
              >
                ← Back to list
              </button>
            )}
            {!selectedId && (
              <p style={{ padding: 32, textAlign: "center", fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                Select a message
              </p>
            )}
            {selectedId && detailLoading && (
              <p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Opening…</p>
            )}
            {detail && !detailLoading && (
              <div style={{ padding: isMobile ? 16 : 24 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <ScoutSecondaryBtn onClick={openReply}>Reply</ScoutSecondaryBtn>
                  <ScoutSecondaryBtn onClick={() => patchMessage({ unread: !detail.unread })}>
                    {detail.unread ? "Mark read" : "Mark unread"}
                  </ScoutSecondaryBtn>
                  <ScoutSecondaryBtn onClick={() => patchMessage({ starred: !detail.starred })}>
                    {detail.starred ? "Unstar" : "Star"}
                  </ScoutSecondaryBtn>
                  <ScoutSecondaryBtn onClick={() => patchMessage({ archive: true })}>Archive</ScoutSecondaryBtn>
                </div>

                <h2 style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
                  {detail.subject}
                </h2>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>From: {detail.from}</p>
                {detail.to && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>To: {detail.to}</p>
                )}
                <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 16px" }}>{detail.dateLabel}</p>

                {detail.attachments.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted }}>
                      Attachments
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {detail.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={withClientScope(`/api/user/email/messages/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(a.id)}`)}
                          style={{
                            fontFamily: fontSans,
                            fontSize: T.caption,
                            color: color.forest,
                            padding: "6px 10px",
                            border: border.line,
                            borderRadius: "var(--scout-radius)",
                            textDecoration: "none",
                          }}
                        >
                          {a.filename}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {detail.thread.length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <button
                      type="button"
                      onClick={() => setShowThread((v) => !v)}
                      style={{
                        border: "none",
                        background: "none",
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.forest,
                        cursor: "pointer",
                        padding: 0,
                        fontWeight: 600,
                      }}
                    >
                      {showThread ? "Hide" : "Show"} thread ({detail.thread.length} messages)
                    </button>
                    {showThread && (
                      <div style={{ marginTop: 8, border: border.line, borderRadius: "var(--scout-radius)" }}>
                        {detail.thread.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => selectMessage(t.id)}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: border.line,
                              background: t.id === detail.id ? "rgba(26,58,47,0.06)" : "transparent",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink }}>{t.from}</span>
                            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}> — {t.subject}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detail.bodyHtml ? (
                  <div
                    style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.65 }}
                    dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
                  />
                ) : (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      color: color.ink,
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {detail.bodyText}
                  </pre>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {compose.open && (
        <>
          <div
            onClick={() => onComposeChange({ ...compose, open: false })}
            style={{ position: "fixed", inset: 0, background: "rgba(26,24,20,0.45)", zIndex: 1000 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(560px, 94vw)",
              maxHeight: "90vh",
              overflow: "auto",
              background: surface.card,
              border: border.lineStrong,
              borderRadius: "var(--scout-radius)",
              zIndex: 1001,
              boxShadow: "8px 8px 0 rgba(17,17,17,0.08)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: border.line, display: "flex", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600 }}>New message</p>
              <button type="button" onClick={() => onComposeChange({ ...compose, open: false })} style={{ border: "none", background: "none", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                To
                <input
                  type="email"
                  value={compose.to}
                  onChange={(e) => onComposeChange({ ...compose, to: e.target.value })}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "10px 12px",
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                  }}
                />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                Subject
                <input
                  type="text"
                  value={compose.subject}
                  onChange={(e) => onComposeChange({ ...compose, subject: e.target.value })}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "10px 12px",
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                  }}
                />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                Message
                <textarea
                  value={compose.body}
                  onChange={(e) => onComposeChange({ ...compose, body: e.target.value })}
                  rows={12}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "10px 12px",
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    resize: "vertical",
                  }}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <ScoutSecondaryBtn onClick={() => onComposeChange({ ...compose, open: false })}>Cancel</ScoutSecondaryBtn>
                <ScoutPrimaryBtn onClick={onSend} disabled={sending}>
                  {sending ? "Sending…" : "Send"}
                </ScoutPrimaryBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
