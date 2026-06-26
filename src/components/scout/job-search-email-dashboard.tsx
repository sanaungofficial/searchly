"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxAgentView } from "./inbox/inbox-agent-view";
import { InboxMailView } from "./inbox/inbox-mail-view";
import type { ComposeState, InboxMode, InboxStatus } from "./inbox/inbox-types";
import { INBOX_PATH } from "@/lib/workspace-urls";

export function JobSearchEmailDashboard() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<InboxMode>(() => (searchParams.get("mode") === "agent" ? "agent" : "mail"));
  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(searchParams.get("messageId"));
  const [compose, setCompose] = useState<ComposeState>({ open: false, to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/nylas/user/status");
    if (!res.ok) return null;
    return res.json() as Promise<InboxStatus>;
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const st = await loadStatus();
      setStatus(st);
    } catch {
      setNotice({ type: "error", text: "Could not load inbox status." });
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    bootstrap().catch(() => setLoading(false));
  }, [bootstrap]);

  useEffect(() => {
    if (searchParams.get("mode") === "agent") setMode("agent");
    const msgId = searchParams.get("messageId");
    if (msgId) {
      setOpenMessageId(msgId);
      setMode("mail");
    }
  }, [searchParams]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({ type: "success", text: "Inbox connected — you can read and send from here." });
      router.replace(INBOX_PATH);
      bootstrap().catch(() => {});
    } else if (inbox === "error") {
      setNotice({
        type: "error",
        text: reason === "denied" ? "Connection cancelled." : "Could not connect your inbox.",
      });
      router.replace(INBOX_PATH);
    }
  }, [searchParams, router, bootstrap]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/user/email/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setNotice({ type: "success", text: `Synced — ${data.processed ?? 0} signals processed.` });
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function updateSettings(patch: Partial<{ enabled: boolean; autoApplyUpdates: boolean }>) {
    setSavingSettings(true);
    const res = await fetch("/api/user/job-agent/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const d = await res.json();
      setStatus((s) => (s ? { ...s, agentEnabled: d.enabled, autoApplyUpdates: d.autoApplyUpdates } : s));
    }
    setSavingSettings(false);
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
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setSending(false);
    }
  }

  function switchMode(next: InboxMode) {
    setMode(next);
    const url = next === "agent" ? `${INBOX_PATH}?mode=agent` : INBOX_PATH;
    router.replace(url);
  }

  function openMailFromAgent(messageId: string) {
    setOpenMessageId(messageId);
    setMode("mail");
    router.replace(`${INBOX_PATH}?messageId=${encodeURIComponent(messageId)}`);
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
          Inbox
        </h2>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 20px" }}>
          Connect Gmail or Outlook to read mail in Kimchi. The agent surfaces job-related messages first — nothing is hidden.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ScoutPrimaryBtn onClick={() => { window.location.href = "/api/nylas/user/connect?returnTo=inbox&provider=google"; }}>
            Connect Gmail
          </ScoutPrimaryBtn>
          <ScoutSecondaryBtn onClick={() => { window.location.href = "/api/nylas/user/connect?returnTo=inbox&provider=microsoft"; }}>
            Connect Outlook
          </ScoutSecondaryBtn>
        </div>
      </ScoutBox>
    );
  }

  const modeTabs: [InboxMode, string][] = [
    ["mail", "Mail"],
    ["agent", "Agent"],
  ];

  return (
    <ScoutBox flat padding="0" style={{ marginTop: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "14px 16px" : "16px 20px", borderBottom: border.line, background: surface.page }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.forest }}>Inbox</h2>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            {status.email}
            {status.provider ? ` · ${status.provider === "microsoft" ? "Outlook" : "Gmail"}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: border.line, borderRadius: "var(--scout-radius)", overflow: "hidden" }}>
            {modeTabs.map(([id, label]) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchMode(id)}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    borderRight: id === "mail" ? border.line : "none",
                    background: active ? color.forest : surface.card,
                    color: active ? color.gold : color.stone,
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {mode === "mail" && (
            <ScoutPrimaryBtn onClick={() => setCompose({ open: true, to: "", subject: "", body: "" })}>Compose</ScoutPrimaryBtn>
          )}
          <ScoutSecondaryBtn onClick={handleSync} disabled={syncing}>{syncing ? "Syncing…" : "Sync agent"}</ScoutSecondaryBtn>
          <ScoutSecondaryBtn onClick={() => bootstrap()} disabled={loading}>Refresh</ScoutSecondaryBtn>
        </div>
      </div>

      {notice && (
        <div style={{ padding: "10px 16px", fontFamily: fontSans, fontSize: T.caption, color: notice.type === "success" ? color.forest : "#C4574A", background: notice.type === "success" ? "rgba(42,107,74,0.08)" : "rgba(196,87,74,0.08)", borderBottom: border.line }}>
          {notice.text}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {mode === "mail" ? (
          <InboxMailView
            status={status}
            initialMessageId={openMessageId}
            onInitialMessageConsumed={() => setOpenMessageId(null)}
            onNotice={setNotice}
            compose={compose}
            onComposeChange={setCompose}
            onSend={handleSend}
            sending={sending}
          />
        ) : (
          <InboxAgentView
            status={status}
            onOpenMail={openMailFromAgent}
            onSync={handleSync}
            syncing={syncing}
            onSettingsChange={updateSettings}
            savingSettings={savingSettings}
            notice={notice}
            onNotice={setNotice}
          />
        )}
      </div>
    </ScoutBox>
  );
}
