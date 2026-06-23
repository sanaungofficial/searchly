"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type CompanyScanSettings = {
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

type IntelRow = {
  id: string;
  name: string;
  slug: string;
  careersUrl: string | null;
  watchlistCount: number;
  jobCount: number;
  lastScannedAt: string | null;
  stale: boolean;
  scannable: boolean;
};

type Dashboard = {
  settings: CompanyScanSettings;
  vercelCronSchedule: string;
  companies: IntelRow[];
  totals: { intelCount: number; scannable: number; stale: number; withJobs: number };
};

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function CompanyScansAdminPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
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

  async function saveSettings() {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/company-scans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.settings),
      });
      if (res.ok) {
        const { settings } = await res.json();
        setData((prev) => (prev ? { ...prev, settings } : prev));
        setMessage("Settings saved.");
      } else {
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
      } else {
        setMessage(body.error ?? "Run failed.");
      }
    } finally {
      setRunning(false);
    }
  }

  if (loading || !data) {
    return <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>Loading company scan dashboard…</p>;
  }

  const { settings, totals } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800 mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          Company job scans
        </h1>
        <p className="text-sm text-stone-500">
          Shared careers scans for the dream-companies watchlist. One scan per company benefits all users tracking it.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">{message}</div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Intel catalog", totals.intelCount],
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

      <section className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-stone-800">Scan configuration</h2>
        <p className="text-xs text-stone-500">
          Vercel cron: <code className="font-mono">{data.vercelCronSchedule}</code>
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="block text-sm text-stone-600">
            Refresh if older than (days)
            <input
              type="number"
              min={1}
              max={90}
              value={settings.refreshIntervalDays}
              onChange={(e) =>
                setData({
                  ...data,
                  settings: { ...settings, refreshIntervalDays: Number(e.target.value) || 7 },
                })
              }
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-stone-600">
            Max companies per cron run
            <input
              type="number"
              min={1}
              max={100}
              value={settings.maxCompaniesPerCronRun}
              onChange={(e) =>
                setData({
                  ...data,
                  settings: { ...settings, maxCompaniesPerCronRun: Number(e.target.value) || 20 },
                })
              }
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-stone-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.autoScanOnAdd}
              onChange={(e) => setData({ ...data, settings: { ...settings, autoScanOnAdd: e.target.checked } })}
            />
            Auto-scan when a user adds a company (if cache is stale)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.cronEnabled}
              onChange={(e) => setData({ ...data, settings: { ...settings, cronEnabled: e.target.checked } })}
            />
            Weekly cron enabled
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {running ? "Running…" : "Run stale scans now"}
          </button>
          <Link href="/admin/prompts" className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 self-center">
            Edit scan prompt →
          </Link>
        </div>

        <div className="text-xs text-stone-500 border-t border-stone-100 pt-4 space-y-1">
          <p>Last cron run: {formatWhen(settings.lastCronRunAt)}</p>
          {settings.lastCronSummary && (
            <p>
              Last result: scanned {settings.lastCronSummary.scanned}, skipped {settings.lastCronSummary.skipped}, failed{" "}
              {settings.lastCronSummary.failed}
              {settings.lastCronSummary.errors.length > 0 && (
                <span className="block mt-1 text-red-600">{settings.lastCronSummary.errors.slice(0, 3).join(" · ")}</span>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-800">Shared company intel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-400 border-b border-stone-100">
                <th className="px-6 py-3">Company</th>
                <th className="px-4 py-3">Watchlists</th>
                <th className="px-4 py-3">Roles cached</th>
                <th className="px-4 py-3">Last scanned</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((row) => (
                <tr key={row.id} className="border-b border-stone-50">
                  <td className="px-6 py-3 font-medium text-stone-800">{row.name}</td>
                  <td className="px-4 py-3 text-stone-600">{row.watchlistCount}</td>
                  <td className="px-4 py-3 text-stone-600">{row.scannable ? row.jobCount : "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{formatWhen(row.lastScannedAt)}</td>
                  <td className="px-4 py-3">
                    {!row.scannable ? (
                      <span className="text-stone-400">No careers URL</span>
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

      <p className="text-xs text-stone-400">
        The extraction prompt lives under Admin → Prompts → <strong>Company Careers Scan</strong> (category: Companies).
      </p>
    </div>
  );
}
