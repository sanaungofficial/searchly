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
  searchId: string | null;
};

type SyncSummary = {
  fetched: number;
  upserted: number;
  pages: number;
  totalCount?: number | null;
  detailErrors?: number;
  subresourceHits?: number;
  fullCatalog?: boolean;
  durationMs: number;
};

const VERCEL_ENV_URL =
  "https://vercel.com/second-ladder/kimchi/settings/environment-variables";

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

function SetupCallout({ status }: { status: SyncStatus }) {
  return (
    <div
      style={{
        marginBottom: 20,
        padding: "14px 16px",
        background: "rgba(196,168,106,0.1)",
        border: "1px solid rgba(196,168,106,0.35)",
      }}
    >
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: "#6B5A2A", margin: "0 0 8px" }}>
        Sync is disabled — Top Echelon credentials are not on this deployment
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "0 0 10px", lineHeight: 1.55 }}>
        The grayed-out button means Kimchi never reached Top Echelon (no MFA email will be sent until this is fixed).
        Add these in Vercel → kimchi → Settings → Environment Variables for <strong>Preview</strong> (dev) and redeploy:
      </p>
      <ul style={{ fontFamily: fontMono, fontSize: T.label, color: color.ink, margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7 }}>
        {status.missingEnv.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
        Use the same email and password you use to log into{" "}
        <a href="https://bigbiller.topechelon.com" target="_blank" rel="noopener noreferrer" style={{ color: color.forest }}>
          bigbiller.topechelon.com
        </a>
        . Optional: <code style={{ fontFamily: fontMono, fontSize: T.label }}>TOPECHELON_SEARCH_ID</code> if you have a saved search.
      </p>
      <a
        href={VERCEL_ENV_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}
      >
        Open Vercel environment variables ↗
      </a>
    </div>
  );
}

export function TopEchelonSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [limit, setLimit] = useState("10");
  const [fullCatalog, setFullCatalog] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);
  const [awaitingMfa, setAwaitingMfa] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setForbidden(false);
    try {
      const res = await fetch("/api/admin/topechelon");
      if (res.status === 403) {
        setForbidden(true);
        setStatus(null);
        return;
      }
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
    if (!status?.configured) {
      setError("Add TOPECHELON_EMAIL and TOPECHELON_PASSWORD in Vercel first, then redeploy dev.");
      return;
    }

    setSyncing(true);
    setError(null);
    setMessage(null);
    setLastSummary(null);

    const parsedLimit = Number(limit);
    const body: {
      limit?: number;
      mfaCode?: string;
      forceLogin?: boolean;
      fullCatalog?: boolean;
    } = {};
    if (!fullCatalog) {
      body.limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    } else {
      body.fullCatalog = true;
    }
    if (mfaCode.trim()) body.mfaCode = mfaCode.trim();
    if (!status.hasSession || awaitingMfa) body.forceLogin = true;

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

      if (res.status === 428 || res.status === 401 || data.code === "MFA_REQUIRED") {
        setAwaitingMfa(true);
        setError(
          data.hint ??
            `Check ${status.emailHint ?? "your Top Echelon inbox"} (and spam) for a 6-digit code from Top Echelon, then paste it above and sync again.`
        );
        return;
      }

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }

      setAwaitingMfa(false);
      setLastSummary(data.summary ?? null);
      setMessage(
        data.summary?.fullCatalog
          ? `Full catalog sync: ${data.summary?.upserted ?? 0} jobs upserted (${data.summary?.pages ?? 0} pages). Check Opportunities → Network.`
          : `Synced ${data.summary?.upserted ?? 0} network jobs. Check Opportunities → Network.`
      );
      setMfaCode("");
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
      <ScoutLabel>Top Echelon network jobs</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        Pull live Big Biller listings into Kimchi — real UUIDs, agency logos, and recruiter data. After credentials are set, the first sync triggers a 6-digit code to your Top Echelon email.
      </p>

      {forbidden && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "0 0 16px" }}>
          Admin access required — log in with an admin account to use this panel.
        </p>
      )}

      {loadingStatus ? (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight }}>Loading sync status…</p>
      ) : status ? (
        <>
          {status.configured ? null : <SetupCallout status={status} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>CONFIGURED</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0, color: status.configured ? color.forest : "#C4574A" }}>
                {status.configured ? "Yes" : "Missing env vars"}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>TE ACCOUNT</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.emailHint ?? "Not set"}</p>
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
        </>
      ) : null}

      {status?.lastSyncError && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 16px" }}>
          Last error: {status.lastSyncError}
        </p>
      )}

      {awaitingMfa && status?.configured && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, margin: "0 0 16px", lineHeight: 1.5 }}>
          Login started — code sent to {status.emailHint ?? "your Top Echelon email"}. Check spam/junk if you do not see it within a minute.
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
            disabled={!status?.configured || fullCatalog}
          />
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", maxWidth: 320, lineHeight: 1.45 }}>
            Re-syncing overlaps updates existing rows (no duplicates). Raise this for a partial import, or use full catalog below.
          </p>
        </div>
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              color: color.ink,
              cursor: status?.configured ? "pointer" : "not-allowed",
              marginBottom: 4,
            }}
          >
            <input
              type="checkbox"
              checked={fullCatalog}
              onChange={(e) => setFullCatalog(e.target.checked)}
              disabled={!status?.configured}
            />
            Full catalog (~1,700 roles)
          </label>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", maxWidth: 280, lineHeight: 1.45 }}>
            Paginates all TE pages, fetches detail + agency/submission/share data per job. May take several minutes.
          </p>
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
            disabled={!status?.configured}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ScoutPrimaryBtn onClick={() => void runSync()} disabled={!canSync}>
          {syncing
            ? fullCatalog
              ? "Full sync running…"
              : "Syncing…"
            : awaitingMfa
              ? "Submit code & sync"
              : fullCatalog
                ? "Sync full catalog"
                : "Sync network jobs"}
        </ScoutPrimaryBtn>
        <ScoutSecondaryBtn onClick={() => void loadStatus()} disabled={syncing}>
          Refresh status
        </ScoutSecondaryBtn>
        {!canSync && status && !status.configured && (
          <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            Add Vercel env vars, redeploy dev, then refresh this page
          </span>
        )}
      </div>

      {message && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "16px 0 0" }}>{message}</p>
      )}
      {lastSummary && (
        <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
          fetched {lastSummary.fetched} · upserted {lastSummary.upserted}
          {lastSummary.pages ? ` · ${lastSummary.pages} pages` : ""}
          {lastSummary.detailErrors ? ` · ${lastSummary.detailErrors} detail fallbacks` : ""}
          {lastSummary.subresourceHits ? ` · ${lastSummary.subresourceHits} sub-resource hits` : ""}
          {" · "}
          {lastSummary.durationMs}ms
        </p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "16px 0 0", lineHeight: 1.5 }}>{error}</p>
      )}
    </ScoutBox>
  );
}
