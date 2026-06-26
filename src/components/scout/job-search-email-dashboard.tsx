"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxInsightsDrawer } from "./inbox/inbox-insights-drawer";
import { InboxMailView } from "./inbox/inbox-mail-view";
import type { ActivitySummary, ComposeState, InboxLens, InboxStatus, PipelineJob } from "./inbox/inbox-types";
import { fetchInboxInsights, type FollowUpSuggestion } from "@/lib/inbox-insights-api";
import { INBOX_PATH } from "@/lib/workspace-urls";

function parseLens(searchParams: URLSearchParams): InboxLens {
  if (searchParams.get("lens") === "work" || searchParams.get("mode") === "expert") return "work";
  return "job_search";
}

function lensConnected(status: InboxStatus, lens: InboxLens): boolean {
  if (lens === "work") return Boolean(status.workInbox?.connected);
  return Boolean(status.jobInbox?.connected ?? status.connected);
}

function lensEmail(status: InboxStatus, lens: InboxLens): string | null {
  if (lens === "work") return status.workInbox?.email ?? null;
  return status.jobInbox?.email ?? status.email;
}

export function JobSearchEmailDashboard() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lens, setLens] = useState<InboxLens>(() => parseLens(searchParams));
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
  const [mailRefreshKey, setMailRefreshKey] = useState(0);

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
      const data = await fetchInboxInsights(lens);
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
  }, [lens]);

  useEffect(() => {
    bootstrap().catch(() => setLoading(false));
  }, [bootstrap]);

  useEffect(() => {
    setLens(parseLens(searchParams));
    const msgId = searchParams.get("messageId");
    if (msgId) setOpenMessageId(msgId);
  }, [searchParams]);

  useEffect(() => {
    setInsightsLoaded(false);
    setActivities([]);
    setFollowUps([]);
    setPendingCount(0);
  }, [lens]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({ type: "success", text: "Inbox connected — check for updates when you're ready." });
      router.replace(`${INBOX_PATH}${lens === "work" ? "?lens=work" : ""}`);
      bootstrap().catch(() => {});
    } else if (inbox === "error") {
      setNotice({
        type: "error",
        text: reason === "denied" ? "Connection cancelled." : "Could not connect your inbox.",
      });
      router.replace(`${INBOX_PATH}${lens === "work" ? "?lens=work" : ""}`);
    }
  }, [searchParams, router, bootstrap, lens]);

  function switchLens(next: InboxLens) {
    setLens(next);
    setOpenMessageId(null);
    const qs = new URLSearchParams();
    if (next === "work") qs.set("lens", "work");
    router.replace(qs.toString() ? `${INBOX_PATH}?${qs.toString()}` : INBOX_PATH);
  }

  async function handleSync() {
    if (lens === "work") {
      setMailRefreshKey((k) => k + 1);
      setNotice({ type: "success", text: "Mail refreshed." });
      return;
    }
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
    if (lens === "work") return;
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
    const qs = new URLSearchParams({ messageId });
    if (lens === "work") qs.set("lens", "work");
    router.replace(`${INBOX_PATH}?${qs.toString()}`);
  }

  const showStaffToggle = Boolean(status?.isStaff && status.workInbox?.available);
  const connected = status ? lensConnected(status, lens) : false;
  const displayEmail = status ? lensEmail(status, lens) : null;

  const lensTabs: [InboxLens, string][] = useMemo(
    () => [
      ["job_search", "Job search"],
      ["work", "Work"],
    ],
    [],
  );

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

  if (!connected) {
    const isWork = lens === "work";
    return (
      <ScoutBox padding={isMobile ? "20px 16px" : "28px 24px"} style={{ marginTop: 16, maxWidth: 560 }}>
        {showStaffToggle && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {lensTabs.map(([id, label]) => (
              <ScoutSecondaryBtn key={id} onClick={() => switchLens(id)}>
                {label}
              </ScoutSecondaryBtn>
            ))}
          </div>
        )}
        <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
          Inbox · {isWork ? "Work" : "Job search"}
        </h2>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 20px" }}>
          {isWork
            ? "Connect your work mailbox with email sync on your expert profile — client and prospect mail stays separate from your personal job search inbox."
            : "Connect Gmail or Outlook for your job search. Kimchi suggests roles to save and follow-ups — you stay in control."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isWork ? (
            <ScoutPrimaryBtn onClick={() => { window.location.href = status.workConnectPath ?? "/dashboard/expert-profile"; }}>
              Set up work inbox
            </ScoutPrimaryBtn>
          ) : (
            <>
              <ScoutPrimaryBtn onClick={() => { window.location.href = "/api/nylas/user/connect?returnTo=inbox&provider=google"; }}>
                Connect Gmail
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn onClick={() => { window.location.href = "/api/nylas/user/connect?returnTo=inbox&provider=microsoft"; }}>
                Connect Outlook
              </ScoutSecondaryBtn>
            </>
          )}
        </div>
      </ScoutBox>
    );
  }

  return (
    <>
      <ScoutBox flat padding="0" style={{ marginTop: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "14px 16px" : "16px 20px", borderBottom: border.line, background: surface.page }}>
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.forest }}>Inbox</h2>
              {showStaffToggle && (
                <div style={{ display: "flex", border: border.line, borderRadius: "var(--scout-radius)", overflow: "hidden" }}>
                  {lensTabs.map(([id, label]) => {
                    const active = lens === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => switchLens(id)}
                        style={{
                          padding: "6px 12px",
                          border: "none",
                          borderRight: id === "job_search" ? border.line : "none",
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
              )}
            </div>
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              {displayEmail}
              {lens === "job_search" && status.provider ? ` · ${status.provider === "microsoft" ? "Outlook" : "Gmail"}` : ""}
              {lens === "work" ? " · Work mail" : ""}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {lens === "job_search" && (
              <ScoutPrimaryBtn onClick={() => setCompose({ open: true, to: "", subject: "", body: "" })}>Compose</ScoutPrimaryBtn>
            )}
            <ScoutSecondaryBtn onClick={handleSync} disabled={syncing && lens === "job_search"}>
              {syncing && lens === "job_search" ? "Syncing…" : lens === "work" ? "Refresh mail" : "Sync mail"}
            </ScoutSecondaryBtn>
          </div>
        </div>

        {notice && (
          <div style={{ padding: "10px 16px", fontFamily: fontSans, fontSize: T.caption, color: notice.type === "success" ? color.forest : "#C4574A", background: notice.type === "success" ? "rgba(42,107,74,0.08)" : "rgba(196,87,74,0.08)", borderBottom: border.line }}>
            {notice.text}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <InboxMailView
            lens={lens}
            mailRefreshKey={mailRefreshKey}
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
        lens={lens}
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
