"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { pipelineJobUrl } from "@/lib/workspace-urls";
import { InboxActivityActions } from "./inbox-activity-actions";
import type { ActivitySummary, CalendarEventRow, InboxStatus, InterviewPrep, PipelineJob } from "./inbox-types";
import { signalLabel } from "./inbox-types";

type FollowUpSuggestion = {
  jobId: string;
  company: string;
  role: string;
  stage: string;
  daysQuiet: number;
  suggestion: string;
  lastMessageId: string | null;
};

type AgentFilter = "pending" | "applied" | "all";

type Props = {
  status: InboxStatus;
  onOpenMail: (messageId: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  onSettingsChange: (patch: Partial<{ enabled: boolean; autoApplyUpdates: boolean }>) => Promise<void>;
  savingSettings: boolean;
  onNotice: (n: { type: "success" | "error"; text: string } | null) => void;
  onCountsChange?: (pending: number) => void;
};

export function InboxAgentView({
  status,
  onOpenMail,
  onSync,
  syncing,
  onSettingsChange,
  savingSettings,
  onNotice,
  onCountsChange,
}: Props) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<AgentFilter>("pending");
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [prepFor, setPrepFor] = useState<string | null>(null);
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [linkJobFor, setLinkJobFor] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam =
        filter === "pending" ? "PENDING_REVIEW" : filter === "applied" ? "APPLIED" : "";
      const [actRes, evRes, jobsRes, followRes, summaryRes] = await Promise.all([
        fetch(`/api/user/job-agent/activity?limit=40${statusParam ? `&status=${statusParam}` : ""}`),
        fetch("/api/user/email/events"),
        fetch("/api/jobs"),
        fetch("/api/user/job-agent/follow-ups"),
        fetch("/api/user/job-agent/activity?summary=1"),
      ]);
      const actData = actRes.ok ? await actRes.json() : { activities: [] };
      const evData = evRes.ok ? await evRes.json() : { events: [] };
      const jobsData = jobsRes.ok ? await jobsRes.json() : [];
      const followData = followRes.ok ? await followRes.json() : { suggestions: [] };
      const summary = summaryRes.ok ? await summaryRes.json() : { pendingCount: 0 };
      setActivities(actData.activities ?? []);
      setEvents(evData.events ?? []);
      setFollowUps(followData.suggestions ?? []);
      onCountsChange?.(summary.pendingCount ?? 0);
      setJobs(
        (Array.isArray(jobsData) ? jobsData : []).map((j: PipelineJob) => ({
          id: j.id,
          company: j.company,
          role: j.role,
          stage: j.stage,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [filter, onCountsChange]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const pendingItems = useMemo(
    () => activities.filter((a) => a.status === "PENDING_REVIEW"),
    [activities],
  );

  async function handleAction(
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
      onNotice({ type: "error", text: "Could not update suggestion." });
      return;
    }
    const labels: Record<string, string> = {
      accept: extra?.applyStage ? "Pipeline updated." : "Added to pipeline.",
      link: "Email linked to role.",
      dismiss: "Dismissed.",
    };
    onNotice({ type: "success", text: labels[action] ?? "Updated." });
    setLinkJobFor(null);
    await load();
  }

  async function loadPrep(activityId: string) {
    setPrepFor(activityId);
    setPrepLoading(true);
    setPrep(null);
    try {
      const res = await fetch("/api/user/job-agent/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrep(data);
    } catch {
      onNotice({ type: "error", text: "Interview prep requires production AI." });
      setPrepFor(null);
    } finally {
      setPrepLoading(false);
    }
  }

  const filterTabs: [AgentFilter, string][] = [
    ["pending", "Needs review"],
    ["applied", "Linked & applied"],
    ["all", "All"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 520 }}>
      <div style={{ flex: 1, minWidth: 0, borderRight: isMobile ? "none" : border.line, overflowY: "auto" }}>
        {followUps.length > 0 && (
          <div style={{ padding: "16px", borderBottom: border.line, background: "rgba(196,168,106,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
              Suggested follow-ups
            </p>
            <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              Pipeline roles with no recent email activity — optional, draft-only.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {followUps.slice(0, 4).map((fu) => (
                <div
                  key={fu.jobId}
                  style={{
                    padding: "12px 14px",
                    background: surface.card,
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                    {fu.company} — {fu.role}
                  </p>
                  <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                    {fu.suggestion}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <ScoutSecondaryBtn onClick={() => { window.location.href = pipelineJobUrl(fu.jobId); }}>
                      View in pipeline
                    </ScoutSecondaryBtn>
                    {fu.lastMessageId && (
                      <ScoutSecondaryBtn onClick={() => onOpenMail(fu.lastMessageId!)}>Open email thread</ScoutSecondaryBtn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: "12px 16px",
            borderBottom: border.line,
            background: surface.page,
            alignItems: "center",
          }}
        >
          {filterTabs.map(([id, label]) => {
            const active = filter === id;
            const count = id === "pending" ? pendingItems.length : undefined;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                style={{
                  padding: "6px 12px",
                  border: active ? `1px solid ${color.forest}` : border.line,
                  borderRadius: "var(--scout-radius)",
                  background: active ? "rgba(26,58,47,0.08)" : surface.card,
                  color: active ? color.forest : color.stone,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {label}
                {count && count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <ScoutSecondaryBtn onClick={() => onSync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync"}
          </ScoutSecondaryBtn>
        </div>

        {loading && (
          <p style={{ padding: 20, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading insights…</p>
        )}

        {!loading && activities.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
              No insights yet
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
              Sync your inbox or open a message in Mail and tap Analyze. Kimchi will suggest linking emails to pipeline roles.
            </p>
            <ScoutPrimaryBtn onClick={() => onSync()} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync inbox now"}
            </ScoutPrimaryBtn>
          </div>
        )}

        {activities.map((a) => {
          const title = a.job ? `${a.job.company} — ${a.job.role}` : a.title ?? signalLabel(a.signal);
          const showPrep = a.signal === "INTERVIEW_INVITE" && a.status === "PENDING_REVIEW";
          return (
            <div
              key={a.id}
              style={{
                padding: "16px",
                borderBottom: border.line,
                background: a.status === "PENDING_REVIEW" ? "rgba(42,107,74,0.03)" : surface.card,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        fontFamily: fontMono,
                        fontSize: 10,
                        fontWeight: 600,
                        color: a.job ? color.forest : "#8A6B2E",
                        background: a.job ? "rgba(42,107,74,0.12)" : "rgba(196,168,106,0.15)",
                        borderRadius: 4,
                      }}
                    >
                      {a.job ? "Linked" : "Unlinked"}
                    </span>
                    <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted }}>
                      {signalLabel(a.signal)}
                      {a.confidence != null ? ` · ${Math.round(a.confidence * 100)}%` : ""}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
                    {title}
                  </p>
                  {a.snippet && (
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.5 }}>
                      {a.snippet}
                    </p>
                  )}
                </div>
                {a.nylasMessageId && (
                  <ScoutSecondaryBtn onClick={() => onOpenMail(a.nylasMessageId!)}>Open email</ScoutSecondaryBtn>
                )}
              </div>

              <InboxActivityActions
                activity={a}
                jobs={jobs}
                linkOpen={linkJobFor === a.id}
                onToggleLink={() => setLinkJobFor(linkJobFor === a.id ? null : a.id)}
                onAction={(action, extra) => handleAction(a, action, extra)}
              />

              {showPrep && (
                <div style={{ marginTop: 8 }}>
                  <ScoutSecondaryBtn onClick={() => loadPrep(a.id)} disabled={prepLoading && prepFor === a.id}>
                    {prepLoading && prepFor === a.id ? "Preparing…" : "Interview prep"}
                  </ScoutSecondaryBtn>
                </div>
              )}

              {prepFor === a.id && prep && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    background: "rgba(42,107,74,0.06)",
                    border: "1px solid rgba(42,107,74,0.2)",
                    borderRadius: "var(--scout-radius)",
                  }}
                >
                  <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                    Interview prep
                  </p>
                  {prep.openingLine && (
                    <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.caption, color: color.ink, fontStyle: "italic" }}>
                      &ldquo;{prep.openingLine}&rdquo;
                    </p>
                  )}
                  {prep.talkingPoints.length > 0 && (
                    <>
                      <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.label, fontWeight: 600 }}>Talking points</p>
                      <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                        {prep.talkingPoints.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {prep.questionsToAsk.length > 0 && (
                    <>
                      <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.label, fontWeight: 600 }}>Questions to ask</p>
                      <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                        {prep.questionsToAsk.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <aside
        style={{
          width: isMobile ? "100%" : 280,
          flexShrink: 0,
          borderTop: isMobile ? border.line : "none",
          overflowY: "auto",
          background: surface.page,
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: border.line }}>
          <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
            Agent settings
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={status.agentEnabled}
              disabled={savingSettings}
              onChange={(e) => onSettingsChange({ enabled: e.target.checked })}
            />
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.ink }}>Watch inbox & calendar</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={status.autoApplyUpdates}
              disabled={savingSettings || !status.agentEnabled}
              onChange={(e) => onSettingsChange({ autoApplyUpdates: e.target.checked })}
            />
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.ink }}>Apply updates without review</span>
          </label>
        </div>

        <div style={{ padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
            Upcoming interviews
          </p>
          {events.length === 0 && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>No interview events in the next 4 weeks.</p>
          )}
          {events.slice(0, 8).map((ev) => (
            <div key={ev.id} style={{ padding: "10px 0", borderBottom: border.line }}>
              <p style={{ margin: "0 0 2px", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink }}>
                {ev.title}
              </p>
              <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, color: color.muted }}>
                {ev.startLabel}
                {ev.activity?.job ? ` · ${ev.activity.job.company}` : ""}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
