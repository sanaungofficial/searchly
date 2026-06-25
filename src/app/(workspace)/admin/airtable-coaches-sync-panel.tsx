"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";

type SyncStatus = {
  configured: boolean;
  missingEnv: string[];
  coachCount: number;
  airtableCoachCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSummary: {
    fetched?: number;
    created?: number;
    updated?: number;
    skipped?: number;
    photoUploaded?: number;
    durationMs?: number;
  } | null;
  baseId: string;
  tableId: string;
  viewId: string;
  pushEnabled: boolean;
  tableName: string | null;
  syncStatuses?: string[];
  expectedCoachCount?: number;
  airtableFields: Array<{ name: string; type: string }> | null;
};

type SyncSummary = {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  photoUploaded: number;
  photoErrors: number;
  errors: string[];
  durationMs: number;
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
        Sync is disabled — Airtable API key is not on this deployment
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "0 0 10px", lineHeight: 1.55 }}>
        Create a Personal Access Token in Airtable with <code style={{ fontFamily: fontMono }}>data.records:read</code>
        {status.pushEnabled ? " and data.records:write" : ""} scope, then add:
      </p>
      <ul style={{ fontFamily: fontMono, fontSize: T.label, color: color.ink, margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7 }}>
        {status.missingEnv.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
        Optional: <code style={{ fontFamily: fontMono }}>AIRTABLE_SYNC_PUSH=true</code> to push Kimchi coach edits back to Airtable.
        Daily cron pulls from Airtable at 5:00 UTC.
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

export function AirtableCoachesSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [limit, setLimit] = useState("");
  const [refreshPhotos, setRefreshPhotos] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setForbidden(false);
    try {
      const res = await fetch("/api/admin/airtable/coaches");
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
      setError("Add AIRTABLE_API_KEY in Vercel first, then redeploy.");
      return;
    }

    setSyncing(true);
    setError(null);
    setMessage(null);
    setLastSummary(null);

    const parsedLimit = Number(limit);
    const body: { limit?: number; refreshPhotos?: boolean } = {};
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) body.limit = parsedLimit;
    if (refreshPhotos) body.refreshPhotos = true;

    try {
      const res = await fetch("/api/admin/airtable/coaches/sync", {
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
        setError(data.hint ? `${data.error ?? "Sync failed"} — ${data.hint}` : data.error ?? "Sync failed");
        return;
      }

      setLastSummary(data.summary ?? null);
      setMessage(
        `Synced ${data.summary?.fetched ?? 0} coaches from Airtable — ${data.summary?.created ?? 0} created, ${data.summary?.updated ?? 0} updated. Check /coaching.`
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
      <ScoutLabel>Airtable coaches</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        Syncs only the <strong>~20 coaches</strong> in your filtered Airtable view (Status: contract sent, onboarding email sent, or active). Re-sync updates existing Kimchi rows by Airtable record ID and backfills missing profile photos to Supabase.
        {status?.pushEnabled
          ? " Kimchi coach profile edits are pushed back to Airtable when linked."
          : " Set AIRTABLE_SYNC_PUSH=true to push Kimchi edits back to Airtable."}
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
          {status.configured ? null : <SetupCallout status={status} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>CONFIGURED</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0, color: status.configured ? color.forest : "#C4574A" }}>
                {status.configured ? "Yes" : "Missing API key"}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>COACHES IN DB</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.coachCount}</p>
            </div>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>FROM AIRTABLE</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.airtableCoachCount}</p>
            </div>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>LAST SYNC</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
                {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px" }}>PUSH TO AIRTABLE</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>{status.pushEnabled ? "On" : "Off"}</p>
            </div>
          </div>
          {status.tableName && (
            <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "0 0 16px" }}>
              Table: {status.tableName} · view {status.viewId}
              {status.syncStatuses?.length
                ? ` · Status: ${status.syncStatuses.join(", ")}`
                : ""}
              {status.expectedCoachCount ? ` · ~${status.expectedCoachCount} coaches` : ""}
            </p>
          )}
        </>
      ) : null}

      {status?.lastSyncError && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 16px" }}>
          Last error: {status.lastSyncError}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, marginBottom: 4 }}>
            Limit (optional)
          </label>
          <input
            type="number"
            min={1}
            placeholder="All"
            style={inputStyle}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={!status?.configured}
          />
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
            }}
          >
            <input
              type="checkbox"
              checked={refreshPhotos}
              onChange={(e) => setRefreshPhotos(e.target.checked)}
              disabled={!status?.configured}
            />
            Re-download photos (default: backfill missing / non-Kimchi URLs)
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ScoutPrimaryBtn onClick={() => void runSync()} disabled={!canSync}>
          {syncing ? "Syncing coaches…" : "Sync from Airtable"}
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
          fetched {lastSummary.fetched} · created {lastSummary.created} · updated {lastSummary.updated}
          {lastSummary.skipped ? ` · skipped ${lastSummary.skipped}` : ""}
          {lastSummary.photoUploaded ? ` · photos ${lastSummary.photoUploaded}` : ""}
          {" · "}
          {lastSummary.durationMs}ms
        </p>
      )}
      {lastSummary && lastSummary.errors && lastSummary.errors.length > 0 && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "8px 0 0", lineHeight: 1.5 }}>
          {lastSummary.errors.slice(0, 3).join(" · ")}
        </p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "16px 0 0", lineHeight: 1.5 }}>{error}</p>
      )}
    </ScoutBox>
  );
}
