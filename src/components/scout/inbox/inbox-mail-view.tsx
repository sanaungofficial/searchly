"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { InboxExpandedMessage } from "./inbox-expanded-message";
import { InboxFolderNav } from "./inbox-folder-nav";
import { InboxMeetingsPanel } from "./inbox-meetings-panel";
import { InboxMessageRow } from "./inbox-message-row";
import { readLastOpenedMessageId, writeLastOpenedMessageId } from "./inbox-row-styles";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [foldersReady, setFoldersReady] = useState(false);
  const [meetingsCollapsed, setMeetingsCollapsed] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);
  const [jobLinkSaving, setJobLinkSaving] = useState(false);
  const [saveContactSaving, setSaveContactSaving] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const [focusUnreadId, setFocusUnreadId] = useState<string | null>(null);
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
    setLastOpenedId(readLastOpenedMessageId(status.email));
  }, [status.email, mailRefreshKey]);

  useEffect(() => {
    if (!connected) return;
    setFoldersReady(false);
    setFolders([]);
    setSelectedFolderId(null);
    setMessages([]);
    setExpandedId(null);
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
    setExpandedId(null);
    setDetail(null);
    setFocusUnreadId(null);
    setHoveredId(null);
    const t = setTimeout(() => {
      loadMessages(selectedFolderId, search)
        .then(({ messages: rows, nextCursor: cursor }) => {
          setMessages(rows);
          setNextCursor(cursor);
          const stored = readLastOpenedMessageId(status.email);
          const storedInList = stored ? rows.some((m) => m.id === stored) : false;
          if (storedInList && stored) {
            setLastOpenedId(stored);
            setFocusUnreadId(null);
          } else {
            setLastOpenedId(null);
            setFocusUnreadId(rows.find((m) => m.unread)?.id ?? null);
          }
        })
        .catch(() => onNotice({ type: "error", text: "Could not load messages." }))
        .finally(() => setListLoading(false));
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [connected, foldersReady, selectedFolderId, search, loadMessages, onNotice, mailRefreshKey]);

  useEffect(() => {
    if (!expandedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    loadDetail(expandedId)
      .then(setDetail)
      .catch(() => {
        onNotice({ type: "error", text: "Could not open message." });
        setExpandedId(null);
      })
      .finally(() => setDetailLoading(false));
  }, [expandedId, loadDetail, onNotice]);

  useEffect(() => {
    if (!initialMessageId) return;
    setExpandedId(initialMessageId);
    setLastOpenedId(initialMessageId);
    writeLastOpenedMessageId(initialMessageId, status.email);
    setFocusUnreadId(null);
    onInitialMessageConsumed?.();
  }, [initialMessageId, onInitialMessageConsumed, status.email]);

  function toggleMessage(id: string) {
    setFocusUnreadId(null);
    setExpandedId((current) => {
      const next = current === id ? null : id;
      if (next) {
        setLastOpenedId(next);
        writeLastOpenedMessageId(next, status.email);
      }
      return next;
    });
  }

  function handleRowHover(id: string, hovering: boolean) {
    if (hovering) {
      setHoveredId(id);
      setFocusUnreadId(null);
    } else {
      setHoveredId((current) => (current === id ? null : current));
    }
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
    if (!expandedId) return;
    const res = await fetch(withClientScope(`/api/user/email/messages/${encodeURIComponent(expandedId)}`), {
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
      prev.map((m) => (m.id === expandedId ? { ...m, unread: data.message.unread, starred: data.message.starred } : m)),
    );
    if (detail) setDetail({ ...detail, unread: data.message.unread, starred: data.message.starred });
    if (patch.archive) {
      setExpandedId(null);
      setMessages((prev) => prev.filter((m) => m.id !== expandedId));
      onNotice({ type: "success", text: "Archived." });
    }
  }

  async function createAndLinkJob(messageId: string, company: string, role: string) {
    setJobLinkSaving(true);
    try {
      const res = await fetch(withClientScope(`/api/user/email/messages/${encodeURIComponent(messageId)}/job`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create: { company, role } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create opportunity");
      const activity = data.activity ?? null;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, activity } : m)));
      if (detail?.id === messageId) {
        const refreshed = await loadDetail(messageId);
        setDetail(refreshed);
      }
      onNotice({ type: "success", text: "Opportunity created and linked." });
    } catch (e) {
      onNotice({ type: "error", text: e instanceof Error ? e.message : "Could not create opportunity." });
    } finally {
      setJobLinkSaving(false);
    }
  }

  async function saveContact(messageId: string) {
    const contactId = detail?.contactCard?.contact?.id;
    if (!contactId) return;
    setSaveContactSaving(true);
    try {
      const res = await fetch(withClientScope(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}/save`), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save contact");
      const refreshed = await loadDetail(messageId);
      setDetail(refreshed);
      onNotice({ type: "success", text: "Contact saved to your address book." });
    } catch (e) {
      onNotice({
        type: "error",
        text: e instanceof Error ? e.message : "Could not save contact — reconnect inbox for contacts access.",
      });
    } finally {
      setSaveContactSaving(false);
    }
  }

  async function linkJob(messageId: string, jobId: string | null) {
    setJobLinkSaving(true);
    try {
      const res = await fetch(withClientScope(`/api/user/email/messages/${encodeURIComponent(messageId)}/job`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not link opportunity");
      const activity = data.activity ?? null;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, activity } : m)));
      if (detail?.id === messageId) {
        const refreshed = await loadDetail(messageId);
        setDetail(refreshed);
      }
      onNotice({ type: "success", text: jobId ? "Linked to opportunity." : "Opportunity link removed." });
    } catch (e) {
      onNotice({ type: "error", text: e instanceof Error ? e.message : "Could not link opportunity." });
    } finally {
      setJobLinkSaving(false);
    }
  }

  async function updateTag(messageId: string, tag: InboxUserTag | null) {
    setTagSaving(true);
    try {
      const res = await fetch(withClientScope(`/api/user/email/messages/${encodeURIComponent(messageId)}/tag`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag ?? "none" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save status");
      const activity = data.activity ?? null;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, activity } : m)));
      if (detail?.id === messageId) setDetail({ ...detail, activity });
    } catch (e) {
      onNotice({ type: "error", text: e instanceof Error ? e.message : "Could not save status." });
    } finally {
      setTagSaving(false);
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

  const showMeetingsPanel = !isMobile && !meetingsCollapsed;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: border.line,
          background: surface.card,
        }}
      >
        <input
          type="search"
          placeholder="Search mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "9px 12px",
            border: border.line,
            borderRadius: 10,
            fontFamily: fontSans,
            fontSize: T.bodySm,
            background: surface.card,
          }}
        />
        {!isMobile && (
          <button
            type="button"
            onClick={() => setMeetingsCollapsed((v) => !v)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: border.line,
              background: meetingsCollapsed ? surface.card : "rgba(42,107,74,0.08)",
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              color: color.forest,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {meetingsCollapsed ? "Show meetings" : "Hide meetings"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {!isMobile && folders.length > 0 && (
          <InboxFolderNav folders={folders} selectedId={selectedFolderId} onSelect={setSelectedFolderId} />
        )}

        <section
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            background: surface.card,
            borderRight: showMeetingsPanel ? border.line : undefined,
          }}
        >
          {isMobile && folders.length > 0 && (
            <div style={{ padding: "8px 12px", borderBottom: border.line, background: surface.page }}>
              <select
                value={selectedFolderId ?? ""}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                aria-label="Mail folder"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  border: border.line,
                  borderRadius: 8,
                  background: surface.card,
                }}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.unread_count ? ` (${f.unread_count})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {listLoading && (
            <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading…</p>
          )}
          {!listLoading && messages.length === 0 && (
            <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>No messages here.</p>
          )}

          {messages.map((msg) => {
            const expanded = msg.id === expandedId;
            return (
              <div key={msg.id} style={{ borderBottom: border.line }}>
                <InboxMessageRow
                  msg={msg}
                  expanded={expanded}
                  hovered={hoveredId === msg.id}
                  isLastOpened={lastOpenedId === msg.id && !expanded}
                  isFocusUnread={focusUnreadId === msg.id && !expanded && lastOpenedId !== msg.id}
                  onToggle={() => toggleMessage(msg.id)}
                  onHover={(hovering) => handleRowHover(msg.id, hovering)}
                />

                {expanded && detailLoading && (
                  <p style={{ padding: "8px 16px 16px 68px", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                    Opening…
                  </p>
                )}
                {expanded && detail && !detailLoading && detail.id === msg.id && (
                  <InboxExpandedMessage
                    detail={detail}
                    tagSaving={tagSaving}
                    jobLinkSaving={jobLinkSaving}
                    saveContactSaving={saveContactSaving}
                    onClose={() => setExpandedId(null)}
                    onReply={openReply}
                    onPatch={patchMessage}
                    onTagChange={(tag) => void updateTag(detail.id, tag)}
                    onLinkJob={(jobId) => void linkJob(detail.id, jobId)}
                    onCreateAndLink={(company, role) => void createAndLinkJob(detail.id, company, role)}
                    onSaveContact={() => void saveContact(detail.id)}
                    onOpenThreadMessage={(id) => {
                      setLastOpenedId(id);
                      writeLastOpenedMessageId(id, status.email);
                      setExpandedId(id);
                    }}
                    scopePath={withClientScope}
                  />
                )}
              </div>
            );
          })}

          {nextCursor && (
            <div style={{ padding: 16, textAlign: "center" }}>
              <ScoutSecondaryBtn onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </ScoutSecondaryBtn>
            </div>
          )}
        </section>

        {showMeetingsPanel ? (
          <InboxMeetingsPanel refreshKey={mailRefreshKey} onToggleCollapse={() => setMeetingsCollapsed(true)} />
        ) : !isMobile && meetingsCollapsed ? (
          <InboxMeetingsPanel collapsed onToggleCollapse={() => setMeetingsCollapsed(false)} />
        ) : null}
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
              borderRadius: 12,
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
                    borderRadius: 8,
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
                    borderRadius: 8,
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
                    borderRadius: 8,
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
