"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

type InboxStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  provider: string | null;
  agentEnabled: boolean;
  autoApplyUpdates: boolean;
};

type Activity = {
  id: string;
  signal: string;
  status: string;
  title: string | null;
  snippet: string | null;
  appliedStage: string | null;
  suggestedStage: string | null;
  createdAt: string;
  job: { company: string; role: string } | null;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  fontFamily: fontMono,
  marginBottom: 8,
};

export function JobSearchInboxPanel() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, act] = await Promise.all([
        fetch("/api/nylas/user/status").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/user/job-agent/activity?limit=8").then((r) => (r.ok ? r.json() : { activities: [] })),
      ]);
      if (st) setStatus(st);
      setActivities(act.activities ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const inbox = searchParams.get("inbox");
    const reason = searchParams.get("reason");
    if (inbox === "connected") {
      setNotice({
        type: "success",
        message: "Job-search inbox connected — Kimchi will watch for application updates.",
      });
      load().catch(() => {});
    } else if (inbox === "error") {
      setNotice({
        type: "error",
        message: reason === "denied"
          ? "Access was denied. Allow Gmail or Outlook mail + calendar permissions and try again."
          : "Could not connect your job-search inbox. Please try again.",
      });
    }
  }, [searchParams, load]);

  async function updateSettings(patch: Partial<{ enabled: boolean; autoApplyUpdates: boolean }>) {
    setSaving(true);
    const r = await fetch("/api/user/job-agent/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      const d = await r.json();
      setStatus((s) => (s ? { ...s, agentEnabled: d.enabled, autoApplyUpdates: d.autoApplyUpdates } : s));
    }
    setSaving(false);
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/nylas/user/disconnect", { method: "POST" });
    await load();
    setDisconnecting(false);
    setNotice({ type: "success", message: "Job-search inbox disconnected." });
  }

  if (loading && !status) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>Loading inbox settings…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {notice && (
        <ScoutBox
          padding="12px 16px"
          style={{
            borderColor: notice.type === "success" ? "rgba(45,122,80,0.25)" : "rgba(220,38,38,0.25)",
            background: notice.type === "success" ? "rgba(45,122,80,0.06)" : "rgba(220,38,38,0.06)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: fontSans,
              fontSize: 14,
              color: notice.type === "success" ? "#2d7a50" : "#dc2626",
            }}
          >
            {notice.message}
          </p>
        </ScoutBox>
      )}

      <ScoutBox padding={20}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 8px" }}>
          Job-search inbox agent
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px", lineHeight: 1.65 }}>
          Create a dedicated Gmail for your job search, connect it here, and manage mail in{" "}
          <Link href="/opportunities/inbox" style={{ color: color.forest, fontWeight: 600 }}>
            Opportunities → Inbox
          </Link>
          . Kimchi will read application emails and calendar invites to keep your pipeline updated.
        </p>

        {status?.connected ? (
          <>
            <p style={{ fontFamily: fontSans, fontSize: 14, color: "#2d7a50", margin: "0 0 12px" }}>
              Connected: {status.email ?? "Inbox linked"}
            </p>
            <ScoutSecondaryBtn onClick={disconnect} disabled={disconnecting} style={{ minHeight: 40 }}>
              {disconnecting ? "Disconnecting…" : "Disconnect inbox"}
            </ScoutSecondaryBtn>
          </>
        ) : status?.configured === false ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>
            Inbox agent is not configured on this environment yet.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/api/nylas/user/connect?provider=google" style={{ textDecoration: "none" }}>
              <ScoutPrimaryBtn type="button" style={{ minHeight: 44 }}>
                Connect Gmail
              </ScoutPrimaryBtn>
            </a>
            <a href="/api/nylas/user/connect?provider=microsoft" style={{ textDecoration: "none" }}>
              <ScoutSecondaryBtn type="button" style={{ minHeight: 44 }}>
                Connect Outlook
              </ScoutSecondaryBtn>
            </a>
          </div>
        )}
      </ScoutBox>

      <ScoutBox padding={20}>
        <p style={labelStyle}>Agent settings</p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 14px", lineHeight: 1.55 }}>
          Enabled by default for all users. Turn off if you do not want Kimchi to read your job-search inbox.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={status?.agentEnabled ?? true}
            disabled={saving}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
          <span style={{ fontFamily: fontSans, fontSize: 14, color: color.ink }}>
            Watch my job-search inbox & calendar
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={status?.autoApplyUpdates ?? true}
            disabled={saving || !status?.agentEnabled}
            onChange={(e) => updateSettings({ autoApplyUpdates: e.target.checked })}
          />
          <span style={{ fontFamily: fontSans, fontSize: 14, color: color.ink }}>
            Automatically update pipeline stages when confidence is high
          </span>
        </label>
      </ScoutBox>

      {activities.length > 0 && (
        <ScoutBox padding={20}>
          <p style={labelStyle}>Recent agent activity</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activities.map((a) => (
              <div key={a.id} style={{ borderTop: `1px solid ${color.muted}22`, paddingTop: 10 }}>
                <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
                  {a.job ? `${a.job.company} · ${a.job.role}` : a.title ?? "Email signal"}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0, lineHeight: 1.5 }}>
                  {a.snippet}
                  {a.appliedStage ? ` → Updated to ${a.appliedStage}` : a.suggestedStage ? ` → Suggested ${a.suggestedStage}` : ""}
                </p>
              </div>
            ))}
          </div>
        </ScoutBox>
      )}
    </div>
  );
}
