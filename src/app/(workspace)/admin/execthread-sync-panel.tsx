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
  catalogImportFrom?: number;
  catalogImportTotalHits?: number | null;
  catalogImportComplete?: boolean;
};

type SyncSummary = {
  mode?: string;
  fetched: number;
  upserted: number;
  failed?: number;
  totalHits: number | null;
  durationMs: number;
  authenticated: boolean;
  previewHits?: number;
  redeemHits?: number;
  pagesRun?: number;
  catalogComplete?: boolean;
  nextFrom?: number | null;
};

const VERCEL_ENV_URL =
  "https://vercel.com/second-ladder/kimchi/settings/environment-variables";

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 120,
  padding: "8px 10px",
  border: "var(--scout-border)",
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
  const [refreshing, setRefreshing] = useState(false);
  const [catalogBatching, setCatalogBatching] = useState(false);
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

  const runRequest = async (body: Record<string, unknown>, mode: "import" | "refresh") => {
    if (!status?.configured) {
      setError("Add EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD in Vercel first, then redeploy.");
      return;
    }

    const setBusy = mode === "refresh" ? setRefreshing : setSyncing;
    setBusy(true);
    setError(null);
    setMessage(null);
    setLastSummary(null);

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
      if (mode === "refresh") {
        const failed = data.summary?.failed ?? 0;
        setMessage(
          `Refreshed ${data.summary?.upserted ?? 0} of ${data.summary?.fetched ?? 0} existing ExecThread jobs` +
            (failed > 0 ? ` (${failed} failed)` : "") +
            ". Check Opportunities → In-Network Roles for full descriptions and recruiter contacts.",
        );
      } else {
        setMessage(
          `Imported ${data.summary?.upserted ?? 0} listings from ExecThread search (${data.summary?.totalHits ?? "?"} total on ExecThread). Existing rows update when the same job appears in search results.`,
        );
      }
      await loadStatus();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const runImport = (forceLogin = false) => {
    const parsedLimit = Number(limit);
    return runRequest(
      {
        limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5,
        forceLogin,
      },
      "import",
    );
  };

  const runRefresh = (forceLogin = false) => runRequest({ refreshExisting: true, forceLogin }, "refresh");

  const runCatalogBatch = (resetCheckpoint = false) => {
    setCatalogBatching(true);
    setError(null);
    setMessage(null);
    setLastSummary(null);
    void (async () => {
      try {
        const res = await fetch("/api/admin/execthread/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            importCatalogBatch: true,
            resetCatalogCheckpoint: resetCheckpoint,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          summary?: SyncSummary;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Catalog batch failed");
          return;
        }
        setLastSummary(data.summary ?? null);
        const s = data.summary;
        setMessage(
          s?.catalogComplete
            ? `Catalog import complete — ${status?.jobCount ?? 0} jobs stored. Cron will now refresh full details in batches.`
            : `Imported ${s?.upserted ?? 0} listings (${s?.pagesRun ?? 0} pages). Cron continues every 15 min until done.`,
        );
        await loadStatus();
      } catch {
        setError("Network error — try again.");
      } finally {
        setCatalogBatching(false);
      }
    })();
  };

  const busy = syncing || refreshing || catalogBatching;
  const canSync = !!status?.configured && !busy;
  const canRefresh = canSync && (status?.jobCount ?? 0) > 0;

  return (
    <ScoutBox padding={24}>
      <ScoutLabel>ExecThread network jobs</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        Import new listings from ExecThread search, or <strong>refresh existing</strong> jobs already in Kimchi to backfill full descriptions, recruiter contacts, and apply links. Sync always reveals confidential info (premium/unlimited ET account; no point budgeting in Kimchi).
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        For large catalogs (~5,806 US/Canada listings), set{" "}
        <code style={{ fontFamily: fontMono, fontSize: T.label }}>EXECTHREAD_SEARCH_JSON</code> in Vercel with your ET filter (including{" "}
        <code style={{ fontFamily: fontMono, fontSize: T.label }}>locations</code>), then use{" "}
        <a href="/admin/network-jobs" style={{ color: color.forest, fontWeight: 600 }}>
          Network catalog →
        </a>{" "}
        to import 100 summaries per click and browse scraped jobs.
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
            {status.catalogImportTotalHits != null && (
              <Stat
                label="Catalog progress"
                value={
                  status.catalogImportComplete
                    ? "Complete"
                    : `${(status.catalogImportFrom ?? 0).toLocaleString()} / ${status.catalogImportTotalHits.toLocaleString()}`
                }
              />
            )}
          </div>

          {status.lastSyncError && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>
              Last error: {status.lastSyncError}
            </p>
          )}

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.muted, margin: "0 0 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Full catalog import (automated)
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", maxWidth: 560, lineHeight: 1.45 }}>
              Cron runs every <strong>15 minutes</strong> and imports up to ~3,000 listing summaries per run until the US/Canada catalog is complete, then refreshes full details in batches of 25. No manual clicking required.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <ScoutPrimaryBtn disabled={!canSync || catalogBatching} onClick={() => runCatalogBatch(false)} style={{ minHeight: 40 }}>
                {catalogBatching ? "Importing batch…" : "Run catalog batch now"}
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn disabled={!canSync || catalogBatching} onClick={() => runCatalogBatch(true)} style={{ minHeight: 40 }}>
                Restart from offset 0
              </ScoutSecondaryBtn>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.muted, margin: "0 0 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Import from search (manual)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Limit</span>
                <input style={inputStyle} value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!canSync} />
              </label>
              <ScoutPrimaryBtn disabled={!canSync} onClick={() => void runImport(false)} style={{ minHeight: 40 }}>
                {syncing ? "Importing…" : "Import from ExecThread →"}
              </ScoutPrimaryBtn>
            </div>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0", maxWidth: 560, lineHeight: 1.45 }}>
              Pulls the top N listings from ExecThread search. Does not re-fetch jobs already in Kimchi unless they appear in this search batch.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.muted, margin: "0 0 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Refresh existing
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <ScoutPrimaryBtn disabled={!canRefresh} onClick={() => void runRefresh(false)} style={{ minHeight: 40 }}>
                {refreshing ? "Refreshing…" : `Refresh ${status.jobCount} existing job${status.jobCount === 1 ? "" : "s"}`}
              </ScoutPrimaryBtn>
            </div>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0", maxWidth: 560, lineHeight: 1.45 }}>
              Re-downloads full posting text, company copy, recruiters, and apply links for every ExecThread job already stored in Kimchi. Use this after code fixes or when listings look truncated.
            </p>
          </div>

          <ScoutSecondaryBtn disabled={!canSync} onClick={() => void runImport(true)} style={{ minHeight: 40 }}>
            Force re-login
          </ScoutSecondaryBtn>

          {error && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "12px 0 0" }}>{error}</p>}
          {message && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "12px 0 0" }}>{message}</p>}
          {lastSummary && (
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "8px 0 0" }}>
              {lastSummary.mode ?? "import"} · fetched {lastSummary.fetched} · upserted {lastSummary.upserted}
              {lastSummary.failed ? ` · failed ${lastSummary.failed}` : ""} · {lastSummary.durationMs}ms
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
