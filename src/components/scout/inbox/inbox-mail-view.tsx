"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutSecondaryBtn, scoutFieldStyle } from "../scout-box";
import { color, fontSans, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { InboxExpandedMessage } from "./inbox-expanded-message";
import { InboxMeetingsPanel } from "./inbox-meetings-panel";
import { InboxMessageRow } from "./inbox-message-row";
import { readLastOpenedMessageId, writeLastOpenedMessageId } from "./inbox-row-styles";
import { InboxTopTabs, type InboxTab } from "./inbox-top-tabs";
import type { ComposeState, Folder, InboxStatus, MessageDetail, MessageSummary } from "./inbox-types";

function pickInboxFolder(folders: Folder[]): Folder | null {
  return (
    folders.find((f) => f.id === "INBOX" || f.name.toLowerCase() === "inbox" || f.name === "Inbox") ??
    folders[0] ??
    null
  );
}

function pickSentFolder(folders: Folder[]): Folder | null {
  return (
    folders.find((f) => f.name.toLowerCase() === "sent" || f.name === "Sent") ??
    folders.find((f) => f.id.toLowerCase().includes("sent")) ??
    null
  );
}

function extraTabFolders(folders: Folder[]): Folder[] {
  const skip = new Set(["inbox", "sent"]);
  return folders.filter((f) => {
    const n = f.name.toLowerCase();
    return !skip.has(n) && (n.includes("archive") || n.includes("draft") || n.includes("spam") || n.includes("trash"));
  });
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
  const [activeTab, setActiveTab] = useState<InboxTab | string>("primary");
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

  const inboxFolder = useMemo(() => pickInboxFolder(folders), [folders]);
  const sentFolder = useMemo(() => pickSentFolder(folders), [folders]);
  const extraFolders = useMemo(() => extraTabFolders(folders), [folders]);

  const selectedFolderId = useMemo(() => {
    if (activeTab === "primary") return inboxFolder?.id ?? null;
    if (activeTab === "sent") return sentFolder?.id ?? null;
    return activeTab;
  }, [activeTab, inboxFolder, sentFolder]);

  const primaryUnread = useMemo(() => messages.filter((m) => m.unread).length, [messages]);

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
    setMessages([]);
    setExpandedId(null);
    setDetail(null);
    loadFolders()
      .then(setFolders)
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
  }, [connected, foldersReady, activeTab, selectedFolderId, search, loadMessages, onNotice, mailRefreshKey, status.email]);

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
    setActiveTab("primary");
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
        setDetail(await loadDetail(messageId));
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
      setDetail(await loadDetail(messageId));
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
        setDetail(await loadDetail(messageId));
      }
      onNotice({ type: "success", text: jobId ? "Linked to opportunity." : "Link removed." });
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

  const showMeetingsPanel = !isMobile && !meetingsCollapsed && activeTab === "primary";

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <InboxTopTabs
        active={activeTab}
        primaryCount={activeTab === "primary" ? primaryUnread : undefined}
        onSelect={(tab) => {
          setActiveTab(tab);
          setExpandedId(null);
        }}
        extraFolders={extraFolders.map((f) => ({ id: f.id, name: f.name }))}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderBottom: "var(--scout-border)",
          background: surface.card,
          flexShrink: 0,
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
            ...scoutFieldStyle,
            padding: "8px 12px",
          }}
        />
        {!isMobile && activeTab === "primary" && (
          <ScoutSecondaryBtn onClick={() => setMeetingsCollapsed((v) => !v)} style={{ whiteSpace: "nowrap", fontSize: T.bodySm }}>
            {meetingsCollapsed ? "Meetings" : "Hide meetings"}
          </ScoutSecondaryBtn>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <section
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: "auto",
              background: surface.card,
              borderRight: showMeetingsPanel ? "var(--scout-border)" : undefined,
            }}
          >
            {listLoading && (
              <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading…</p>
            )}
            {!listLoading && messages.length === 0 && (
              <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>No messages here.</p>
            )}

            {messages.map((msg) => {
              const expanded = msg.id === expandedId;
              return (
                <div key={msg.id} style={{ borderBottom: "var(--scout-border)" }}>
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
                    <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Opening…</p>
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
        ) : !isMobile && meetingsCollapsed && activeTab === "primary" ? (
          <InboxMeetingsPanel collapsed onToggleCollapse={() => setMeetingsCollapsed(false)} />
        ) : null}
      </div>
    </div>
  );
}
