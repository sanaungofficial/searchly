"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type InboxStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  provider: string | null;
  agentEnabled: boolean;
  autoApplyUpdates: boolean;
};

type Folder = { id: string; name: string; unread_count?: number };

type MessageSummary = {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  dateLabel: string;
  unread: boolean;
  activity: {
    id: string;
    signal: string;
    status: string;
    suggestedStage: string | null;
    confidence: number;
    job: { id: string; company: string; role: string; stage: string } | null;
  } | null;
};

type MessageDetail = MessageSummary & {
  to: string;
  cc: string;
  bodyHtml: string | null;
  bodyText: string;
  activity: {
    id: string;
    signal: string;
    status: string;
    suggestedStage: string | null;
    appliedStage: string | null;
    confidence: number;
    title: string | null;
    snippet: string | null;
    companyGuess: string | null;
    roleGuess: string | null;
    job: { id: string; company: string; role: string; stage: string } | null;
  } | null;
};

type ComposeState = {
  open: boolean;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
};

function pickInboxFolder(folders: Folder[]): Folder | null {
  return folders.find((f) => f.id === "INBOX" || f.name.toLowerCase() === "inbox") ?? folders[0] ?? null;
}

export function JobSearchEmailDashboard() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [compose, setCompose] = useState<ComposeState>({
    open: false,
    to: "",
    subject: "",
    body: "",
  });
  const [sending, setSending] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/nylas/user/status");
    if (!res.ok) return null;
    return res.json() as Promise<InboxStatus>;
  }, []);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/user/email/folders");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === "string" ? data.error : "Could not load folders");
    }
    const data = await res.json();
    return (data.folders ?? []) as Folder[];
  }, []);

  const loadMessages = useCallback(async (folderId: string | null, q: string) => {
    const params = new URLSearchParams();
    if (folderId) params.set("folderId", folderId);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/user/email/messages?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === "string" ? data.error : "Could not load messages");
    }
    const data = await res.json();
    return (data.messages ?? []) as MessageSummary[];
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/user/email/messages/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("detail");
    return res.json() as Promise<MessageDetail>;
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const st = await loadStatus();
      setStatus(st);
      if (!st?.connected) return;

      try {
        const f = await loadFolders();
        setFolders(f);
        const inbox = pickInboxFolder(f);
        if (inbox) setSelectedFolderId(inbox.id);
      } catch (err) {
        setFolders([]);
        setSelectedFolderId(null);
        setNotice({
          type: "error",
          text: err instanceof Error ? err.message : "Could not load folders — showing recent mail instead.",
        });
      }
    } catch {
      setNotice({ type: "error", text: "Could not load inbox status." });
    } finally {
      setLoading(false);
    }
  }, [loadStatus, loadFolders]);

  useEffect(() => {
    bootstrap().catch(() => setLoading(false));
  }, [bootstrap]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({ type: "success", text: "Gmail connected — you can read and send from here." });
      router.replace("/opportunities/inbox");
      bootstrap().catch(() => {});
    } else if (inbox === "error") {
      setNotice({
        type: "error",
        text:
          reason === "denied"
            ? "Connection cancelled. Allow Gmail mail + calendar permissions to continue."
            : "Could not connect Gmail. Try again.",
      });
      router.replace("/opportunities/inbox");
    }
  }, [searchParams, router, bootstrap]);

  useEffect(() => {
    if (!status?.connected) return;
    setListLoading(true);
    const t = setTimeout(() => {
      loadMessages(selectedFolderId, search)
        .then((rows) => {
          setMessages(rows);
          if (selectedId && !rows.some((m) => m.id === selectedId)) {
            setSelectedId(null);
            setDetail(null);
          }
        })
        .catch((err) =>
          setNotice({
            type: "error",
            text: err instanceof Error ? err.message : "Could not load messages.",
          }),
        )
        .finally(() => setListLoading(false));
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [status?.connected, selectedFolderId, search, loadMessages, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    loadDetail(selectedId)
      .then(setDetail)
      .catch(() => setNotice({ type: "error", text: "Could not open message." }))
      .finally(() => setDetailLoading(false));
  }, [selectedId, loadDetail]);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/user/email/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setNotice({ type: "success", text: `Synced — ${data.processed ?? 0} new signals processed.` });
      setMessages(await loadMessages(selectedFolderId, search));
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleAgentAction(action: "accept" | "dismiss") {
    if (!detail?.activity) return;
    const res = await fetch(`/api/user/job-agent/activity/${detail.activity.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setNotice({ type: "error", text: "Could not update suggestion." });
      return;
    }
    setNotice({ type: "success", text: action === "accept" ? "Pipeline updated." : "Suggestion dismissed." });
    if (selectedId) loadDetail(selectedId).then(setDetail);
  }

  function openCompose(partial?: Partial<ComposeState>) {
    setCompose({
      open: true,
      to: partial?.to ?? "",
      subject: partial?.subject ?? "",
      body: partial?.body ?? "",
      replyToMessageId: partial?.replyToMessageId,
    });
  }

  function openReply() {
    if (!detail) return;
    const reSubject = detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`;
    openCompose({
      to: detail.from.replace(/^.*<([^>]+)>.*$/, "$1").trim() || detail.from,
      subject: reSubject,
      body: `\n\n---\n${detail.bodyText.slice(0, 2000)}`,
      replyToMessageId: detail.id,
    });
  }

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch("/api/user/email/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: compose.subject,
          body: compose.body,
          to: [{ email: compose.to.trim() }],
          replyToMessageId: compose.replyToMessageId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setCompose({ open: false, to: "", subject: "", body: "" });
      setNotice({ type: "success", text: "Message sent." });
      setMessages(await loadMessages(selectedFolderId, search));
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setSending(false);
    }
  }

  function selectMessage(id: string) {
    setSelectedId(id);
    if (isMobile) setMobilePane("detail");
  }

  if (loading) {
    return (
      <ScoutBox padding="24px" style={{ marginTop: 16 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading inbox…</p>
      </ScoutBox>
    );
  }

  if (!status?.configured) {
    return (
      <ScoutBox padding="24px" style={{ marginTop: 16, maxWidth: 560 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: 0 }}>
          Email integration is not configured on this environment.
        </p>
      </ScoutBox>
    );
  }

  if (!status.connected) {
    return (
      <ScoutBox padding={isMobile ? "20px 16px" : "28px 24px"} style={{ marginTop: 16, maxWidth: 560 }}>
        <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
          Job-search inbox
        </h2>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 20px" }}>
          Connect a dedicated Gmail inbox to read recruiter mail, reply from Kimchi, and let the agent track application updates in your pipeline.
        </p>
        <ScoutPrimaryBtn
          onClick={() => {
            window.location.href = "/api/nylas/user/connect?returnTo=opportunities&provider=google";
          }}
        >
          Connect Gmail
        </ScoutPrimaryBtn>
      </ScoutBox>
    );
  }

  const showList = !isMobile || mobilePane === "list";
  const showDetail = !isMobile || mobilePane === "detail";

  return (
    <ScoutBox
      flat
      padding="0"
      style={{
        marginTop: 16,
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: isMobile ? "16px" : "18px 20px",
          borderBottom: border.line,
          background: surface.page,
        }}
      >
        <div style={{ minWidth: 180 }}>
          <h2 style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.forest }}>
            Job-search inbox
          </h2>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            {status.email} · Gmail
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, flex: "1 1 280px", justifyContent: "flex-end" }}>
          <input
            type="search"
            placeholder="Search mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 180px",
              maxWidth: 260,
              padding: "9px 12px",
              border: border.line,
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.bodySm,
              background: surface.card,
            }}
          />
          <ScoutSecondaryBtn onClick={() => bootstrap()} disabled={loading}>
            Refresh
          </ScoutSecondaryBtn>
          <ScoutSecondaryBtn onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync agent"}
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={() => openCompose()}>Compose</ScoutPrimaryBtn>
        </div>
      </div>

      {notice && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 16px",
            fontFamily: fontSans,
            fontSize: T.caption,
            color: notice.type === "success" ? color.forest : "#C4574A",
            background: notice.type === "success" ? "rgba(42,107,74,0.08)" : "rgba(196,87,74,0.08)",
            borderBottom: border.line,
          }}
        >
          <span>{notice.text}</span>
          {notice.type === "error" && (
            <button
              type="button"
              onClick={() => bootstrap()}
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                flexShrink: 0,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: isMobile ? 420 : 520 }}>
        {/* Folders */}
        {!isMobile && folders.length > 0 && (
          <aside
            style={{
              width: 188,
              flexShrink: 0,
              borderRight: border.line,
              overflowY: "auto",
              background: surface.page,
            }}
          >
            {folders.map((folder) => {
              const active = folder.id === selectedFolderId;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "11px 14px",
                    border: "none",
                    borderBottom: border.line,
                    background: active ? "rgba(26,58,47,0.08)" : "transparent",
                    color: active ? color.forest : color.stone,
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{folder.name}</span>
                  {folder.unread_count ? (
                    <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted }}>
                      {folder.unread_count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </aside>
        )}

        {/* Message list */}
        {showList && (
          <section
            style={{
              width: isMobile ? "100%" : 340,
              flexShrink: 0,
              borderRight: isMobile ? "none" : border.line,
              overflowY: "auto",
              background: surface.card,
            }}
          >
            {isMobile && folders.length > 0 && (
              <div style={{ padding: "10px 12px", borderBottom: border.line, background: surface.page }}>
                <select
                  value={selectedFolderId ?? ""}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                    background: surface.card,
                  }}
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: border.line,
                background: surface.page,
              }}
            >
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted }}>
                {selectedFolder?.name ?? "All mail"}
              </p>
            </div>
            {listLoading && (
              <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading messages…</p>
            )}
            {!listLoading && messages.length === 0 && (
              <div style={{ padding: 20, textAlign: "center" }}>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 6px" }}>
                  No messages here
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                  Try another folder or run Sync agent to pull recruiter updates.
                </p>
              </div>
            )}
            {messages.map((msg) => {
              const active = msg.id === selectedId;
              return (
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
                    background: active ? "rgba(26,58,47,0.06)" : msg.unread ? "rgba(26,58,47,0.03)" : "transparent",
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
                      {msg.from}
                    </span>
                    <span style={{ fontFamily: fontMono, fontSize: 10, color: color.muted, flexShrink: 0 }}>
                      {msg.dateLabel}
                    </span>
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
                  {msg.activity && (
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        padding: "2px 8px",
                        fontFamily: fontMono,
                        fontSize: 10,
                        fontWeight: 600,
                        color: color.forest,
                        background: "rgba(42,107,74,0.12)",
                        borderRadius: 4,
                      }}
                    >
                      Kimchi · {msg.activity.signal.replace(/_/g, " ")}
                    </span>
                  )}
                </button>
              );
            })}
          </section>
        )}

        {/* Detail */}
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
              <div style={{ padding: 32, textAlign: "center" }}>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                  Select a message to read
                </p>
              </div>
            )}
            {selectedId && detailLoading && (
              <p style={{ padding: 24, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Opening…</p>
            )}
            {detail && !detailLoading && (
              <div style={{ padding: isMobile ? 16 : 24 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <ScoutSecondaryBtn onClick={openReply}>Reply</ScoutSecondaryBtn>
                  <ScoutPrimaryBtn onClick={() => openCompose()}>New message</ScoutPrimaryBtn>
                </div>
                <h2 style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
                  {detail.subject}
                </h2>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>
                  From: {detail.from}
                </p>
                {detail.to && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>
                    To: {detail.to}
                  </p>
                )}
                <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 20px" }}>
                  {detail.dateLabel}
                </p>

                {detail.activity && (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: 16,
                      border: "1px solid rgba(42,107,74,0.25)",
                      background: "rgba(42,107,74,0.06)",
                      borderRadius: "var(--scout-radius)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontFamily: fontSans,
                        fontSize: T.label,
                        fontWeight: 600,
                        color: color.forest,
                      }}
                    >
                      Kimchi agent
                    </p>
                    <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                      {detail.activity.title ?? detail.activity.signal.replace(/_/g, " ")}
                    </p>
                    {detail.activity.snippet && (
                      <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.5 }}>
                        {detail.activity.snippet}
                      </p>
                    )}
                    {detail.activity.suggestedStage && detail.activity.status !== "APPLIED" && detail.activity.status !== "DISMISSED" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <ScoutPrimaryBtn onClick={() => handleAgentAction("accept")}>
                          Accept → {detail.activity.suggestedStage}
                        </ScoutPrimaryBtn>
                        <ScoutSecondaryBtn onClick={() => handleAgentAction("dismiss")}>Dismiss</ScoutSecondaryBtn>
                      </div>
                    )}
                    {detail.activity.job && (
                      <p style={{ margin: "10px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                        Linked: {detail.activity.job.role} @ {detail.activity.job.company}
                      </p>
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
            onClick={() => setCompose((c) => ({ ...c, open: false }))}
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
              <button type="button" onClick={() => setCompose((c) => ({ ...c, open: false }))} style={{ border: "none", background: "none", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                To
                <input
                  type="email"
                  value={compose.to}
                  onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", border: border.line, borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: T.bodySm }}
                />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                Subject
                <input
                  type="text"
                  value={compose.subject}
                  onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", border: border.line, borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: T.bodySm }}
                />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                Message
                <textarea
                  value={compose.body}
                  onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                  rows={12}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", border: border.line, borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: T.bodySm, resize: "vertical" }}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <ScoutSecondaryBtn onClick={() => setCompose((c) => ({ ...c, open: false }))}>Cancel</ScoutSecondaryBtn>
                <ScoutPrimaryBtn onClick={handleSend} disabled={sending}>
                  {sending ? "Sending…" : "Send"}
                </ScoutPrimaryBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </ScoutBox>
  );
}
