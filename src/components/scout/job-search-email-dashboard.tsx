"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn, scoutFieldStyle } from "./scout-box";
import { color, fontSans, radius, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxContactDrawer } from "./inbox/inbox-contact-drawer";
import { InboxLeadsPanel } from "./inbox/inbox-leads-panel";
import { InboxMailView } from "./inbox/inbox-mail-view";
import type { ComposeState, InboxStatus } from "./inbox/inbox-types";
import { useWorkspaceStackTop } from "@/hooks/use-workspace-stack-top";
import { backdropBelowNav } from "@/lib/z-layers";
import { NETWORKING_INBOX_PATH, type NetworkingSection } from "@/lib/workspace-urls";

type Props = {
  section: Exclude<NetworkingSection, "in-network">;
};

export function JobSearchEmailDashboard({ section }: Props) {
  const isMobile = useIsMobile();
  const stackTop = useWorkspaceStackTop();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { withClientScope, isAdminReviewing, adminReviewClientId } = useWorkspace();

  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(searchParams.get("messageId"));
  const [selectedContactId, setSelectedContactId] = useState<string | null>(searchParams.get("contactId"));
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
    if (contactId) setSelectedContactId(contactId);
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
      router.replace(withClientScope(NETWORKING_INBOX_PATH));
      bootstrap().catch(() => {});
    } else if (inbox === "error") {
      setNotice({
        type: "error",
        text: reason === "denied" ? "Connection cancelled." : "Could not connect inbox.",
      });
      router.replace(withClientScope(NETWORKING_INBOX_PATH));
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
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading…</p>
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
      {section === "inbox" && connected && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, flexShrink: 0 }}>
          <ScoutPrimaryBtn onClick={() => setCompose({ open: true, to: "", subject: "", body: "" })}>Compose</ScoutPrimaryBtn>
          <ScoutSecondaryBtn onClick={handleRefresh}>Refresh</ScoutSecondaryBtn>
        </div>
      )}

      <ScoutBox
        padding={0}
        style={{
          flex: 1,
          minHeight: isMobile ? 520 : "min(72vh, 840px)",
          maxHeight: isMobile ? undefined : "calc(100vh - 260px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: surface.card,
        }}
      >
        {section === "inbox" && !connected && (
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
                ? "This client’s Gmail or Outlook isn’t connected yet. Connect their inbox on their behalf to read and send mail."
                : "Connect Gmail or Outlook to read and send mail here."}
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
          {section === "leads" ? (
            <InboxLeadsPanel
              scopePath={withClientScope}
              mailConnected={connected}
              onSelectContact={(id) => setSelectedContactId(id)}
              onComposeTo={(email) => setCompose({ open: true, to: email, subject: "", body: "" })}
            />
          ) : (
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
          )}
        </div>
      </ScoutBox>

      {selectedContactId && (
        <InboxContactDrawer
          contactId={selectedContactId}
          scopePath={withClientScope}
          mailConnected={connected}
          onClose={() => setSelectedContactId(null)}
          onOpenMessage={(messageId) => {
            router.push(withClientScope(`${NETWORKING_INBOX_PATH}${NETWORKING_INBOX_PATH.includes("?") ? "&" : "?"}messageId=${encodeURIComponent(messageId)}`));
          }}
          onComposeTo={(email) => {
            setCompose({ open: true, to: email, subject: "", body: "" });
            router.push(withClientScope(NETWORKING_INBOX_PATH));
          }}
          onNotice={setNotice}
        />
      )}

      {compose.open && (
        <>
          <div
            onClick={() => setCompose({ ...compose, open: false })}
            style={{ ...backdropBelowNav(stackTop), background: "rgba(26,24,20,0.45)", zIndex: 1000 }}
          />
          <div
            className="bruddle"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(560px, 94vw)",
              maxHeight: "90vh",
              overflow: "auto",
              background: surface.card,
              border: "var(--scout-border)",
              borderRadius: radius.px,
              zIndex: 1001,
              boxShadow: "4px 4px 0 #161616",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "var(--scout-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink }}>New message</p>
              <button type="button" onClick={() => setCompose({ ...compose, open: false })} style={{ border: "none", background: "none", cursor: "pointer", color: color.mutedLight, fontSize: 20 }}>
                ✕
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                To
                <input
                  type="email"
                  value={compose.to}
                  onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  style={{ ...scoutFieldStyle, display: "block", marginTop: 4 }}
                />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                Subject
                <input
                  type="text"
                  value={compose.subject}
                  onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  style={{ ...scoutFieldStyle, display: "block", marginTop: 4 }}
                />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                Message
                <textarea
                  value={compose.body}
                  onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                  rows={12}
                  style={{ ...scoutFieldStyle, display: "block", marginTop: 4, resize: "vertical" }}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <ScoutSecondaryBtn onClick={() => setCompose({ ...compose, open: false })}>Cancel</ScoutSecondaryBtn>
                <ScoutPrimaryBtn onClick={() => void handleSend()} disabled={sending || !compose.to.trim()}>
                  {sending ? "Sending…" : "Send"}
                </ScoutPrimaryBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
