"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ActivitySummary, CalendarEventRow, InboxStatus, InterviewPrep, PipelineJob } from "./inbox-types";
import { signalLabel } from "./inbox-types";

type AgentFilter = "pending" | "applied" | "all";

type Props = {
  status: InboxStatus;
  onOpenMail: (messageId: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  onSettingsChange: (patch: Partial<{ enabled: boolean; autoApplyUpdates: boolean }>) => Promise<void>;
  savingSettings: boolean;
  notice: { type: "success" | "error"; text: string } | null;
  onNotice: (n: { type: "success" | "error"; text: string } | null) => void;
};

export function InboxAgentView({
  status,
  onOpenMail,
  onSync,
  syncing,
  onSettingsChange,
  savingSettings,
  notice,
  onNotice,
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam =
        filter === "pending" ? "PENDING_REVIEW" : filter === "applied" ? "APPLIED" : "";
      const [actRes, evRes, jobsRes] = await Promise.all([
        fetch(`/api/user/job-agent/activity?limit=40${statusParam ? `&status=${statusParam}` : ""}`),
        fetch("/api/user/email/events"),
        fetch("/api/jobs"),
      ]);
      const actData = actRes.ok ? await actRes.json() : { activities: [] };
      const evData = evRes.ok ? await evRes.json() : { events: [] };
      const jobsData = jobsRes.ok ? await jobsRes.json() : [];
      setActivities(actData.activities ?? []);
      setEvents(evData.events ?? []);
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
  }, [filter]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const pendingCount = useMemo(
    () => activities.filter((a) => a.status === "PENDING_REVIEW").length,
    [activities],
  );

  async function handleAction(
    activity: ActivitySummary,
    action: "accept" | "dismiss",
    extra?: { jobId?: string; createJob?: boolean },
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
    onNotice({ type: "success", text: action === "accept" ? "Pipeline updated." : "Dismissed." });
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
    ["applied", "Applied"],
    ["all", "All"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 520 }}>
      <div style={{ flex: 1, minWidth: 0, borderRight: isMobile ? "none" : border.line, overflowY: "auto" }}>
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
                {id === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <ScoutSecondaryBtn onClick={() => onSync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync agent"}
          </ScoutSecondaryBtn>
        </div>

        {loading && (
          <p style={{ padding: 20, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading agent queue…</p>
        )}

        {!loading && activities.length === 0 && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 8px" }}>
              No agent items in this view
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
              Sync agent or open Mail to analyze a message.
            </p>
          </div>
        )}

        {activities.map((a) => {
          const title = a.job ? `${a.job.company} — ${a.job.role}` : a.title ?? signalLabel(a.signal);
          const showPrep = a.signal === "INTERVIEW_INVITE" && a.status === "PENDING_REVIEW";
          return (
            <div key={a.id} style={{ padding: "16px", borderBottom: border.line }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
                    {title}
                  </p>
                  <p style={{ margin: "0 0 4px", fontFamily: fontMono, fontSize: T.label, color: color.muted }}>
                    {signalLabel(a.signal)}
                    {a.confidence != null ? ` · ${Math.round(a.confidence * 100)}%` : ""}
                    {a.suggestedStage ? ` → ${a.suggestedStage}` : ""}
                  </p>
                  {a.snippet && (
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.5 }}>
                      {a.snippet}
                    </p>
                  )}
                </div>
                {a.nylasMessageId && (
                  <ScoutSecondaryBtn onClick={() => onOpenMail(a.nylasMessageId!)}>Open mail</ScoutSecondaryBtn>
                )}
              </div>

              {a.status === "PENDING_REVIEW" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {a.suggestedStage && (
                    <ScoutPrimaryBtn
                      onClick={() =>
                        handleAction(a, "accept", {
                          createJob: !a.job && Boolean(a.companyGuess),
                          jobId: a.job?.id,
                        })
                      }
                    >
                      Accept{a.suggestedStage ? ` → ${a.suggestedStage}` : ""}
                    </ScoutPrimaryBtn>
                  )}
                  <ScoutSecondaryBtn onClick={() => handleAction(a, "dismiss")}>Dismiss</ScoutSecondaryBtn>
                  {!a.job && (
                    <ScoutSecondaryBtn onClick={() => setLinkJobFor(linkJobFor === a.id ? null : a.id)}>
                      Link job
                    </ScoutSecondaryBtn>
                  )}
                  {showPrep && (
                    <ScoutSecondaryBtn onClick={() => loadPrep(a.id)} disabled={prepLoading && prepFor === a.id}>
                      {prepLoading && prepFor === a.id ? "Preparing…" : "Interview prep"}
                    </ScoutSecondaryBtn>
                  )}
                </div>
              )}

              {linkJobFor === a.id && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const jobId = e.target.value;
                      if (jobId) handleAction(a, "accept", { jobId });
                    }}
                    style={{
                      flex: 1,
                      minWidth: 200,
                      padding: "8px 10px",
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      border: border.line,
                      borderRadius: "var(--scout-radius)",
                    }}
                  >
                    <option value="">Select pipeline job…</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.company} — {j.role}
                      </option>
                    ))}
                  </select>
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
          width: isMobile ? "100%" : 300,
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
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.ink }}>Auto-apply high confidence</span>
          </label>
        </div>

        <div style={{ padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
            Upcoming calendar
          </p>
          {events.length === 0 && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>No events in the next 4 weeks.</p>
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
