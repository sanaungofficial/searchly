"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";

type SyncStatus = {
  configured: boolean;
  hasSession: boolean;
  jobCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  searchId: string | null;
};

type SyncSummary = {
  fetched: number;
  upserted: number;
  pages: number;
  durationMs: number;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 280,
  padding: "8px 10px",
  border: border.line,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  background: surface.card,
  boxSizing: "border-box",
};

export function TopEchelonSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [limit, setLimit] = useState("10");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/topechelon");
      if (res.ok) {
        setStatus((await res.json()) as SyncStatus);
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    setLastSummary(null);

    const parsedLimit = Number(limit);
    const body: { limit?: number; mfaCode?: string; forceLogin?: boolean } = {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
    };
    if (mfaCode.trim()) body.mfaCode = mfaCode.trim();
    if (!status?.hasSession) body.forceLogin = true;

    try {
      const res = await fetch("/api/admin/topechelon/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        summary?: SyncSummary;
        error?: string;
        hint?: string;
        code?: string;
      };

      if (res.status === 428 || res.status === 401) {
        setError(data.hint ?? data.error ?? "MFA code required — check your email.");
        return;
      }

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }

      setLastSummary(data.summary ?? null);
      setMessage(`Synced ${data.summary?.upserted ?? 0} network jobs. Check Opportunities → In-Network.`);
      setMfaCode("");
      await loadStatus();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScoutBox padding={24}>
      <ScoutLabel>Top Echelon network jobs</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        Pull live Big Biller listings into Kimchi — real UUIDs, agency logos, and recruiter data. First sync (or expired session) sends a 6-digit code to your Top Echelon email.
      </p>

      {loadingStatus ? (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight }}>Loading sync status…</p>
      ) : status ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div>
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>CONFIGURED</p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.configured ? "Yes" : "No — set TE env vars"}</p>
          </div>
          <div>
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>SESSION</p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.hasSession ? "Active" : "Needs login"}</p>
          </div>
          <div>
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>JOBS IN DB</p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.jobCount}</p>
          </div>
          <div>
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>LAST SYNC</p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
              {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
            </p>
          </div>
        </div>
      ) : null}

      {status?.lastSyncError && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 16px" }}>
          Last error: {status.lastSyncError}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, marginBottom: 4 }}>
            Jobs to import
          </label>
          <input
            type="number"
            min={1}
            max={50}
            style={{ ...inputStyle, maxWidth: 100 }}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, marginBottom: 4 }}>
            Email MFA code (if prompted)
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            style={inputStyle}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ScoutPrimaryBtn onClick={() => void runSync()} disabled={syncing || !status?.configured}>
          {syncing ? "Syncing…" : "Sync network jobs"}
        </ScoutPrimaryBtn>
        <ScoutSecondaryBtn onClick={() => void loadStatus()} disabled={syncing}>
          Refresh status
        </ScoutSecondaryBtn>
      </div>

      {message && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "16px 0 0" }}>{message}</p>
      )}
      {lastSummary && (
        <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
          fetched {lastSummary.fetched} · upserted {lastSummary.upserted} · {lastSummary.durationMs}ms
        </p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "16px 0 0", lineHeight: 1.5 }}>{error}</p>
      )}
    </ScoutBox>
  );
}
