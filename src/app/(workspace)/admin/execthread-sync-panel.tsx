"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";

type SyncStatus = {
  configured: boolean;
  hasEmail: boolean;
  hasPassword: boolean;
  missingEnv: string[];
  emailHint: string | null;
  hasSession: boolean;
  jobCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  apiBase: string;
};

type SyncSummary = {
  fetched: number;
  upserted: number;
  totalHits: number | null;
  durationMs: number;
  authenticated: boolean;
  previewHits?: number;
  redeemHits?: number;
};

const VERCEL_ENV_URL =
  "https://vercel.com/second-ladder/kimchi/settings/environment-variables";

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 120,
  padding: "8px 10px",
  border: border.line,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  background: surface.card,
  boxSizing: "border-box",
};

export function ExecThreadSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [limit, setLimit] = useState("5");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setForbidden(false);
    try {
      const res = await fetch("/api/admin/execthread");
      if (res.status === 403) {
        setForbidden(true);
        setStatus(null);
        return;
      }
      if (res.ok) setStatus((await res.json()) as SyncStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const runSync = async (forceLogin = false) => {
    if (!status?.configured) {
      setError("Add EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD in Vercel first, then redeploy.");
      return;
    }

    setSyncing(true);
    setError(null);
    setMessage(null);
    setLastSummary(null);

    const parsedLimit = Number(limit);
    const body = {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5,
      forceLogin,
    };

    try {
      const res = await fetch("/api/admin/execthread/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        summary?: SyncSummary;
        error?: string;
        hint?: string;
      };

      if (!res.ok || !data.ok) {
        setError([data.error, data.hint].filter(Boolean).join(" — "));
        return;
      }

      setLastSummary(data.summary ?? null);
      setMessage(
        `Synced ${data.summary?.upserted ?? 0} ExecThread listings (${data.summary?.totalHits ?? "?"} total on ExecThread). Check Opportunities → In-Network Roles.`,
      );
      await loadStatus();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSyncing(false);
    }
  };

  const canSync = !!status?.configured && !syncing;

  return (
    <ScoutBox padding={24}>
      <ScoutLabel>ExecThread network jobs</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        Pull executive listings from ExecThread into Kimchi In-Network Roles — same flow as Top Echelon. Start with 5 jobs to verify, then increase the limit.
      </p>

      {forbidden && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "0 0 16px" }}>
          Admin access required.
        </p>
      )}

      {loadingStatus ? (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight }}>Loading sync status…</p>
      ) : status ? (
        <>
          {!status.configured && (
            <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(196,168,106,0.1)", border: "1px solid rgba(196,168,106,0.35)" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: "#6B5A2A", margin: "0 0 8px" }}>
                Add Vercel env vars
              </p>
              <ul style={{ fontFamily: fontMono, fontSize: T.label, margin: "0 0 12px", paddingLeft: 18 }}>
                {status.missingEnv.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
              <a href={VERCEL_ENV_URL} target="_blank" rel="noopener noreferrer" style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                Open Vercel environment variables ↗
              </a>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Stat label="Configured" value={status.configured ? "Yes" : "No"} />
            <Stat label="Account" value={status.emailHint ?? "Not set"} />
            <Stat label="Session" value={status.hasSession ? "Stored" : "None"} />
            <Stat label="ET jobs in DB" value={String(status.jobCount)} />
            <Stat label="Last sync" value={status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"} />
          </div>

          {status.lastSyncError && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>
              Last error: {status.lastSyncError}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Limit</span>
              <input style={inputStyle} value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!canSync} />
            </label>
            <ScoutPrimaryBtn disabled={!canSync} onClick={() => void runSync(false)} style={{ minHeight: 40 }}>
              {syncing ? "Syncing…" : "Sync ExecThread →"}
            </ScoutPrimaryBtn>
            <ScoutSecondaryBtn disabled={!canSync} onClick={() => void runSync(true)} style={{ minHeight: 40 }}>
              Force re-login
            </ScoutSecondaryBtn>
          </div>

          {error && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "0 0 12px" }}>{error}</p>}
          {message && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "0 0 12px" }}>{message}</p>}
          {lastSummary && (
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: 0 }}>
              fetched {lastSummary.fetched} · upserted {lastSummary.upserted} · {lastSummary.durationMs}ms
              {lastSummary.authenticated ? " · authenticated" : ""}
              {lastSummary.previewHits != null ? ` · ${lastSummary.previewHits} previews` : ""}
              {lastSummary.redeemHits != null && lastSummary.redeemHits > 0 ? ` · ${lastSummary.redeemHits} redeems` : ""}
            </p>
          )}
        </>
      ) : null}
    </ScoutBox>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>{label.toUpperCase()}</p>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{value}</p>
    </div>
  );
}
