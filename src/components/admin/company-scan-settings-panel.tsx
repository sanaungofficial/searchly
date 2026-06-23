"use client";

import { useCallback, useEffect, useState } from "react";

export type CompanyScanSettings = {
  refreshIntervalDays: number;
  maxCompaniesPerCronRun: number;
  autoScanOnAdd: boolean;
  cronEnabled: boolean;
  lastCronRunAt: string | null;
  lastCronSummary: {
    scanned: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null;
};

type PanelData = {
  settings: CompanyScanSettings;
  vercelCronSchedule: string;
};

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "#3d3530",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  border: "1px solid #e8e2da",
  borderRadius: 6,
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  boxSizing: "border-box",
};

export function CompanyScanSettingsPanel({
  compact,
  onSaved,
}: {
  compact?: boolean;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/company-scans");
      if (res.ok) {
        const body = await res.json();
        setData({ settings: body.settings, vercelCronSchedule: body.vercelCronSchedule });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveSettings() {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/company-scans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.settings),
      });
      if (res.ok) {
        const { settings } = await res.json();
        setData((prev) => (prev ? { ...prev, settings } : prev));
        setSaveStatus("saved");
        setMessage("Settings saved.");
        onSaved?.();
      } else {
        setSaveStatus("error");
        setMessage("Couldn't save settings.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/company-scans/run", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setMessage(`Manual run complete — scanned ${body.summary.scanned}, skipped ${body.summary.skipped}, failed ${body.summary.failed}.`);
        await load();
        onSaved?.();
      } else {
        setMessage(body.error ?? "Run failed.");
      }
    } finally {
      setRunning(false);
    }
  }

  if (loading || !data) {
    return <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>Loading scan settings…</p>;
  }

  const { settings } = data;

  return (
    <div>
      {!compact && (
        <p style={{ fontSize: 13, color: "var(--scout-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          Controls when shared CompanyIntel careers scans run. The extraction prompt is edited separately under{" "}
          <strong>Company Careers Scan</strong>.
        </p>
      )}

      <p style={{ fontSize: 12, color: "var(--scout-muted)", fontFamily: "var(--font-dm-mono)", marginBottom: 16 }}>
        Vercel cron: {data.vercelCronSchedule}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <label style={labelStyle}>
          Refresh if older than (days)
          <input
            type="number"
            min={1}
            max={90}
            value={settings.refreshIntervalDays}
            onChange={(e) => {
              setData({
                ...data,
                settings: { ...settings, refreshIntervalDays: Number(e.target.value) || 7 },
              });
              setSaveStatus("idle");
            }}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Max companies per cron run
          <input
            type="number"
            min={1}
            max={100}
            value={settings.maxCompaniesPerCronRun}
            onChange={(e) => {
              setData({
                ...data,
                settings: { ...settings, maxCompaniesPerCronRun: Number(e.target.value) || 20 },
              });
              setSaveStatus("idle");
            }}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, fontSize: 13, fontFamily: "var(--font-ui)", color: "#3d3530" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.autoScanOnAdd}
            onChange={(e) => {
              setData({ ...data, settings: { ...settings, autoScanOnAdd: e.target.checked } });
              setSaveStatus("idle");
            }}
          />
          Auto-scan when a user adds a company (if cache is stale)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.cronEnabled}
            onChange={(e) => {
              setData({ ...data, settings: { ...settings, cronEnabled: e.target.checked } });
              setSaveStatus("idle");
            }}
          />
          Weekly cron enabled
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          style={{ padding: "8px 18px", border: "none", borderRadius: 6, background: "#1a3a2f", color: "#fff", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          style={{ padding: "8px 14px", border: "1px solid #e8e2da", borderRadius: 6, background: "transparent", color: "var(--scout-muted)", fontFamily: "var(--font-ui)", fontSize: 13, cursor: running ? "default" : "pointer", opacity: running ? 0.6 : 1 }}
        >
          {running ? "Running…" : "Run stale scans now"}
        </button>
        {saveStatus === "saved" && <span style={{ fontSize: 13, color: "#2d7a50" }}>Saved</span>}
        {saveStatus === "error" && <span style={{ fontSize: 13, color: "#b45309" }}>Error saving</span>}
      </div>

      {(message || settings.lastCronRunAt) && (
        <div style={{ fontSize: 12, color: "var(--scout-muted)", borderTop: "1px solid #f0ece6", paddingTop: 14, lineHeight: 1.6 }}>
          {message && <p style={{ margin: "0 0 8px 0", color: "#3d3530" }}>{message}</p>}
          <p style={{ margin: 0 }}>Last cron run: {formatWhen(settings.lastCronRunAt)}</p>
          {settings.lastCronSummary && (
            <p style={{ margin: "4px 0 0 0" }}>
              Last result: scanned {settings.lastCronSummary.scanned}, skipped {settings.lastCronSummary.skipped}, failed{" "}
              {settings.lastCronSummary.failed}
              {settings.lastCronSummary.errors.length > 0 && (
                <span style={{ display: "block", marginTop: 4, color: "#b45309" }}>
                  {settings.lastCronSummary.errors.slice(0, 3).join(" · ")}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
