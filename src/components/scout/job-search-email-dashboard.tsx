"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { bruddleHeadingStyle, color, fontSans, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxMailView } from "./inbox/inbox-mail-view";
import type { ComposeState, InboxStatus } from "./inbox/inbox-types";
import { INBOX_PATH } from "@/lib/workspace-urls";

export function JobSearchEmailDashboard() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { withClientScope, isAdminReviewing, adminReviewClientId } = useWorkspace();

  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(searchParams.get("messageId"));
  const [openContactId, setOpenContactId] = useState<string | null>(searchParams.get("contactId"));
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
    const contactId = searchParams.get("contactId");
    if (contactId) setOpenContactId(contactId);
  }, [searchParams]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({
        type: "success",
        text: isAdminReviewing
          ? "Client inbox connected — mail and contacts will sync shortly."
          : "Inbox connected — ask Kimchi in chat about your mail anytime.",
      });
      router.replace(withClientScope(INBOX_PATH));
      bootstrap().catch(() => {});
    } else if (inbox === "error") {
      setNotice({
        type: "error",
        text: reason === "denied" ? "Connection cancelled." : "Could not connect inbox.",
      });
      router.replace(withClientScope(INBOX_PATH));
    }
  }, [searchParams, router, bootstrap, isAdminReviewing, withClientScope]);

  async function handleRefresh() {
    if (!status?.connected) return;
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

  function connectInbox(provider: "google" | "microsoft") {
    if (isAdminReviewing && adminReviewClientId) {
      window.location.href = `/api/admin/clients/${encodeURIComponent(adminReviewClientId)}/nylas/connect?provider=${provider}`;
      return;
    }
    window.location.href = `/api/nylas/user/connect?returnTo=inbox&provider=${provider}`;
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

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <header style={{ marginBottom: isMobile ? 16 : 20, flexShrink: 0 }}>
        <h1 style={bruddleHeadingStyle("h5")}>Inbox</h1>
        <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.5 }}>
          {connected ? (
            <>
              {status.email}
              {status.provider ? ` · ${status.provider === "microsoft" ? "Outlook" : "Gmail"}` : ""}
              {" · "}Mail, contacts, and pipeline links
            </>
          ) : (
            <>
              CRM contacts available now
              {isAdminReviewing ? " — connect this client’s inbox when ready" : " — connect mail to read and send email"}
            </>
          )}
        </p>
        {connected && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <ScoutPrimaryBtn onClick={() => setCompose({ open: true, to: "", subject: "", body: "" })}>Compose</ScoutPrimaryBtn>
            <ScoutSecondaryBtn onClick={handleRefresh}>Refresh</ScoutSecondaryBtn>
          </div>
        )}
      </header>

      <ScoutBox
        padding={0}
        style={{
          flex: 1,
          minHeight: isMobile ? 520 : "min(72vh, 840px)",
          maxHeight: isMobile ? undefined : "calc(100vh - 180px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: surface.card,
        }}
      >

      {!connected && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "var(--scout-border)",
            background: "rgba(42,107,74,0.06)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
            {isAdminReviewing
              ? "This client’s Gmail or Outlook isn’t connected yet. You can manage contacts below, or connect their inbox on their behalf."
              : "Your CRM contacts are ready. Connect Gmail or Outlook when you want to read and send mail here."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn onClick={() => connectInbox("google")}>Connect Gmail</ScoutPrimaryBtn>
            <ScoutSecondaryBtn onClick={() => connectInbox("microsoft")}>Connect Outlook</ScoutSecondaryBtn>
          </div>
        </div>
      )}

      {notice && (
        <div
          style={{
            padding: "10px 16px",
            fontFamily: fontSans,
            fontSize: T.caption,
            color: notice.type === "success" ? color.forest : "#C4574A",
            background: notice.type === "success" ? "rgba(42,107,74,0.08)" : "rgba(196,87,74,0.08)",
            borderBottom: "var(--scout-border)",
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
          initialContactId={openContactId}
          onInitialContactConsumed={() => setOpenContactId(null)}
          onNotice={setNotice}
          compose={compose}
          onComposeChange={setCompose}
          onSend={handleSend}
          sending={sending}
        />
      </div>
    </ScoutBox>
    </div>
  );
}
