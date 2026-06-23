"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CompanyScanSettingsPanel } from "@/components/admin/company-scan-settings-panel";
import { CompanyLogo } from "@/components/scout/company-logo";
import { COMPANY_SCAN_SETTINGS_SIDEBAR } from "@/lib/company-scan-config";

type IntelRow = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  careersUrl: string | null;
  watchlistCount: number;
  jobCount: number;
  jobsSource: string | null;
  hirebaseSlug: string | null;
  hirebaseJobBoard: string | null;
  hirebaseOpenJobs: number | null;
  hirebaseLinkedIn: string | null;
  hirebaseProfileAt: string | null;
  lastScannedAt: string | null;
  stale: boolean;
  scannable: boolean;
};

type SyncResult = {
  catalogSlug: string;
  name: string;
  ok: boolean;
  hirebaseSlug?: string;
  jobBoard?: string | null;
  totalOpenJobs?: number | null;
  error?: string;
};

type Dashboard = {
  vercelCronSchedule: string;
  hirebaseConfigured?: boolean;
  companies: IntelRow[];
  totals: {
    intelCount: number;
    scannable: number;
    stale: number;
    withJobs: number;
    withHirebaseProfile?: number;
  };
};

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function CompanyScansAdminPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [syncingHirebase, setSyncingHirebase] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/company-scans");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function backfillWebsites() {
    setBackfilling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/company-scans/backfill-websites", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setMessage(`Backfilled ${body.updated} catalog websites (${body.skipped} had no catalog match).`);
        await load();
      } else {
        setMessage(body.error ?? "Backfill failed.");
      }
    } finally {
      setBackfilling(false);
    }
  }

  async function syncHirebaseTop50() {
    setSyncingHirebase(true);
    setMessage(null);
    setSyncResults(null);
    try {
      const res = await fetch("/api/admin/company-scans/sync-hirebase-companies", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setSyncResults(body.results ?? []);
        setMessage(`Hirebase company sync complete — ${body.synced} matched, ${body.failed} missed (top 50 catalog).`);
        await load();
      } else {
        setMessage(body.error ?? "Hirebase sync failed.");
      }
    } finally {
      setSyncingHirebase(false);
    }
  }

  if (loading || !data) {
    return <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>Loading company scan dashboard…</p>;
  }

  const { totals } = data;
  const top50Rows = data.companies.filter((c) => c.hirebaseProfileAt || c.hirebaseSlug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800 mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          Company job scans
        </h1>
        <p className="text-sm text-stone-500">
          Shared careers scans for the dream-companies watchlist. Hirebase supplies verified company profiles and job
          indexes — start with company data, then run role scans. Edit the prompt and schedule under{" "}
          <Link href="/admin/prompts" className="text-stone-700 underline">
            Admin → Prompts
          </Link>{" "}
          (Companies).
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">{message}</div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ["Intel catalog", totals.intelCount],
          ["Hirebase profiles", totals.withHirebaseProfile ?? top50Rows.length],
          ["Scannable", totals.scannable],
          ["Stale (need refresh)", totals.stale],
          ["With cached roles", totals.withJobs],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-xl border border-stone-200 px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-1">{label}</p>
            <p className="text-2xl font-semibold text-stone-800">{value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Hirebase company data (top 50)</h2>
            <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
              Pulls live company profiles from Hirebase: logo, LinkedIn, ATS/job board, headcount range, industries,
              sub-industries, and indexed open-role counts. Stored on shared CompanyIntel — no AI guesswork for these fields.
            </p>
          </div>
          <button
            type="button"
            onClick={syncHirebaseTop50}
            disabled={syncingHirebase || !data.hirebaseConfigured}
            className="rounded-lg bg-stone-800 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {syncingHirebase ? "Syncing 50 companies…" : "Sync top 50 from Hirebase"}
          </button>
        </div>
        {!data.hirebaseConfigured && (
          <p className="text-xs text-amber-700 mb-4">Add HIREBASE_API_KEY on Vercel or .env.local to enable sync.</p>
        )}
        {syncResults && (
          <div className="overflow-x-auto border border-stone-100 rounded-lg max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-stone-50">
                <tr className="text-left text-stone-500 uppercase tracking-wider">
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Hirebase slug</th>
                  <th className="px-3 py-2">Job board</th>
                  <th className="px-3 py-2">Open roles</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {syncResults.map((row) => (
                  <tr key={row.catalogSlug} className="border-t border-stone-50">
                    <td className="px-3 py-2 text-stone-800">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-stone-600">{row.hirebaseSlug ?? "—"}</td>
                    <td className="px-3 py-2 text-stone-600">{row.jobBoard ?? "—"}</td>
                    <td className="px-3 py-2 text-stone-600">{row.totalOpenJobs ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.ok ? <span className="text-emerald-700">OK</span> : <span className="text-amber-700">{row.error ?? "Miss"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">{COMPANY_SCAN_SETTINGS_SIDEBAR.label}</h2>
            <p className="text-xs text-stone-500 mt-1">Same settings as Admin → Prompts → Companies.</p>
          </div>
          <Link href="/admin/prompts" className="text-sm text-stone-600 underline shrink-0">
            Open in Prompts →
          </Link>
        </div>
        <CompanyScanSettingsPanel onSaved={load} />
      </section>

      <section className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-stone-800">Shared company intel</h2>
          <button
            type="button"
            onClick={backfillWebsites}
            disabled={backfilling}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 disabled:opacity-50"
          >
            {backfilling ? "Backfilling…" : "Backfill catalog websites"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-400 border-b border-stone-100">
                <th className="px-6 py-3">Company</th>
                <th className="px-4 py-3">Watchlists</th>
                <th className="px-4 py-3">Hirebase</th>
                <th className="px-4 py-3">Job board</th>
                <th className="px-4 py-3">Open roles</th>
                <th className="px-4 py-3">Roles cached</th>
                <th className="px-4 py-3">Last scanned</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((row) => (
                <tr key={row.id} className="border-b border-stone-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={row.name} website={row.website} careersUrl={row.careersUrl} size={28} />
                      <span className="font-medium text-stone-800">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{row.watchlistCount}</td>
                  <td className="px-4 py-3 text-xs font-mono text-stone-500">
                    {row.hirebaseSlug ? row.hirebaseSlug : row.hirebaseProfileAt ? "synced" : "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{row.hirebaseJobBoard ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {row.hirebaseOpenJobs != null ? row.hirebaseOpenJobs.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{row.scannable ? row.jobCount : "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{formatWhen(row.lastScannedAt)}</td>
                  <td className="px-4 py-3">
                    {!row.scannable ? (
                      <span className="text-stone-400">Not scannable</span>
                    ) : row.stale ? (
                      <span className="text-amber-700">Stale</span>
                    ) : (
                      <span className="text-emerald-700">Fresh</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
