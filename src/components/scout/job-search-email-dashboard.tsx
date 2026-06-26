"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxInsightsDrawer } from "./inbox/inbox-insights-drawer";
import { InboxMailView } from "./inbox/inbox-mail-view";
import type { ActivitySummary, ComposeState, InboxStatus, PipelineJob } from "./inbox/inbox-types";
import { fetchInboxInsights, type FollowUpSuggestion } from "@/lib/inbox-insights-api";
import { INBOX_PATH } from "@/lib/workspace-urls";

export function JobSearchEmailDashboard() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(searchParams.get("messageId"));
  const [compose, setCompose] = useState<ComposeState>({ open: false, to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const loadStatus = useCallback(async () => {
    const stRes = await fetch("/api/nylas/user/status");
    if (!stRes.ok) return null;
    return stRes.json() as Promise<InboxStatus>;
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

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const data = await fetchInboxInsights();
      setActivities(data.activities);
      setJobs(data.jobs);
      setFollowUps(data.followUps);
      setPendingCount(data.pendingCount);
      setInsightsLoaded(true);
    } catch {
      setNotice({ type: "error", text: "Could not check email for updates." });
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap().catch(() => setLoading(false));
  }, [bootstrap]);

  useEffect(() => {
    const msgId = searchParams.get("messageId");
    if (msgId) setOpenMessageId(msgId);
  }, [searchParams]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({ type: "success", text: "Inbox connected — check email for updates when you're ready." });
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
      setNotice({ type: "success", text: `Synced — ${data.processed ?? 0} updates from your mail.` });
      if (insightsLoaded) await loadInsights();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleCheckEmail() {
    await loadInsights();
  }

  async function handleInsightAction(
    activity: ActivitySummary,
    action: "accept" | "dismiss" | "link",
    extra?: { jobId?: string; createJob?: boolean; applyStage?: boolean },
  ) {
    const res = await fetch(`/api/user/job-agent/activity/${activity.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      setNotice({ type: "error", text: "Could not save that — try again." });
      return;
    }
    const labels: Record<string, string> = {
      accept: extra?.applyStage ? "Status updated." : "Role saved to your list.",
      link: "Email matched to that role.",
      dismiss: "Got it — we'll show less like this.",
    };
    setNotice({ type: "success", text: labels[action] ?? "Saved." });
    await loadInsights();
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

  function openMailFromInsight(messageId: string) {
    setOpenMessageId(messageId);
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
          Connect Gmail or Outlook. Kimchi reads your mail, suggests roles to save, and surfaces follow-ups — you stay in control.
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

  return (
    <>
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
            <ScoutPrimaryBtn onClick={() => setCompose({ open: true, to: "", subject: "", body: "" })}>Compose</ScoutPrimaryBtn>
            <ScoutSecondaryBtn onClick={handleSync} disabled={syncing}>{syncing ? "Syncing…" : "Sync mail"}</ScoutSecondaryBtn>
          </div>
        </div>

        {notice && (
          <div style={{ padding: "10px 16px", fontFamily: fontSans, fontSize: T.caption, color: notice.type === "success" ? color.forest : "#C4574A", background: notice.type === "success" ? "rgba(42,107,74,0.08)" : "rgba(196,87,74,0.08)", borderBottom: border.line }}>
            {notice.text}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <InboxMailView
            status={status}
            initialMessageId={openMessageId}
            onInitialMessageConsumed={() => setOpenMessageId(null)}
            onNotice={setNotice}
            compose={compose}
            onComposeChange={setCompose}
            onSend={handleSend}
            sending={sending}
            onOpenMail={openMailFromInsight}
            insightsLoaded={insightsLoaded}
            insightsLoading={insightsLoading}
            onCheckEmail={handleCheckEmail}
            onViewAllInsights={() => setDrawerOpen(true)}
            activities={activities}
            jobs={jobs}
            pendingCount={pendingCount}
            onInsightAction={handleInsightAction}
          />
        </div>
      </ScoutBox>

      <InboxInsightsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        insightsLoaded={insightsLoaded}
        insightsLoading={insightsLoading}
        onCheckEmail={handleCheckEmail}
        activities={activities}
        jobs={jobs}
        followUps={followUps}
        onOpenMail={openMailFromInsight}
        onAction={handleInsightAction}
      />
    </>
  );
}
