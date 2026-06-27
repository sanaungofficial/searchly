"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxMailView } from "./inbox/inbox-mail-view";
import type { ComposeState, InboxStatus } from "./inbox/inbox-types";
import { INBOX_PATH } from "@/lib/workspace-urls";

export function JobSearchEmailDashboard() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { withClientScope, isAdminReviewing } = useWorkspace();

  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(searchParams.get("messageId"));
  const [compose, setCompose] = useState<ComposeState>({ open: false, to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [mailRefreshKey, setMailRefreshKey] = useState(0);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const stRes = await fetch(withClientScope("/api/nylas/user/status"));
      if (stRes.ok) setStatus(await stRes.json());
    } catch {
      setNotice({ type: "error", text: "Could not load inbox status." });
    } finally {
      setLoading(false);
    }
  }, [withClientScope]);

  useEffect(() => {
    bootstrap().catch(() => setLoading(false));
  }, [bootstrap]);

  useEffect(() => {
    if (!status?.connected) return;
    fetch(withClientScope("/api/user/inbox/contacts/sync"), { method: "POST" }).catch(() => {});
  }, [status?.connected, withClientScope, mailRefreshKey]);

  useEffect(() => {
    const msgId = searchParams.get("messageId");
    if (msgId) setOpenMessageId(msgId);
  }, [searchParams]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({
        type: "success",
        text: "Inbox connected — ask Kimchi in chat about your mail anytime.",
      });
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

  async function handleRefresh() {
    setMailRefreshKey((k) => k + 1);
    setNotice({ type: "success", text: "Mail refreshed." });
  }

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(withClientScope("/api/user/email/messages/send"), {
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
      setMailRefreshKey((k) => k + 1);
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setSending(false);
    }
  }

  const connected = Boolean(status?.connected);

  if (loading) {
    return (
      <ScoutBox padding="16px" style={{ marginTop: 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading inbox…</p>
      </ScoutBox>
    );
  }

  if (!status?.configured) {
    return (
      <ScoutBox padding="16px" style={{ marginTop: 0, maxWidth: 560 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: 0 }}>
          Email integration is not configured on this environment.
        </p>
      </ScoutBox>
    );
  }

  if (!connected) {
    return (
      <ScoutBox padding={isMobile ? "16px" : "20px"} style={{ marginTop: 0, maxWidth: 520 }}>
        <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
          Inbox
        </h2>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 20px" }}>
          {isAdminReviewing
            ? "This client has not connected Gmail or Outlook yet. They need to connect from their own account."
            : "Connect Gmail or Outlook to read and send mail here. For summaries, drafts, and pipeline updates, use Kimchi chat or voice."}
        </p>
        {!isAdminReviewing && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ScoutPrimaryBtn onClick={() => { window.location.href = "/api/nylas/user/connect?returnTo=inbox&provider=google"; }}>
            Connect Gmail
          </ScoutPrimaryBtn>
          <ScoutSecondaryBtn onClick={() => { window.location.href = "/api/nylas/user/connect?returnTo=inbox&provider=microsoft"; }}>
            Connect Outlook
          </ScoutSecondaryBtn>
        </div>
        )}
      </ScoutBox>
    );
  }

  return (
    <ScoutBox
      padding={0}
      style={{
        flex: 1,
        minHeight: isMobile ? 520 : "min(78vh, 880px)",
        maxHeight: isMobile ? undefined : "calc(100vh - 132px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.card,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: isMobile ? "12px 14px" : "14px 16px",
          borderBottom: border.line,
          background: surface.card,
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 20, fontWeight: 600, color: color.forest }}>
            Inbox
          </h2>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            {status.email}
            {status.provider ? ` · ${status.provider === "microsoft" ? "Outlook" : "Gmail"}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ScoutPrimaryBtn onClick={() => setCompose({ open: true, to: "", subject: "", body: "" })}>Compose</ScoutPrimaryBtn>
          <ScoutSecondaryBtn onClick={handleRefresh}>Refresh</ScoutSecondaryBtn>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: "10px 16px",
            fontFamily: fontSans,
            fontSize: T.caption,
            color: notice.type === "success" ? color.forest : "#C4574A",
            background: notice.type === "success" ? "rgba(42,107,74,0.08)" : "rgba(196,87,74,0.08)",
            borderBottom: border.line,
          }}
        >
          {notice.text}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <InboxMailView
          mailRefreshKey={mailRefreshKey}
          status={status}
          initialMessageId={openMessageId}
          onInitialMessageConsumed={() => setOpenMessageId(null)}
          onNotice={setNotice}
          compose={compose}
          onComposeChange={setCompose}
          onSend={handleSend}
          sending={sending}
        />
      </div>
    </ScoutBox>
  );
}
