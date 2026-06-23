"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CompanyScanSettingsPanel } from "@/components/admin/company-scan-settings-panel";
import { COMPANY_SCAN_SETTINGS_SIDEBAR } from "@/lib/company-scan-config";

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

  if (loading || !data) {
    return <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>Loading company scan dashboard…</p>;
  }

  const { totals } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800 mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          Company job scans
        </h1>
        <p className="text-sm text-stone-500">
          Shared careers scans for the dream-companies watchlist. Edit the prompt and schedule under{" "}
          <Link href="/admin/prompts" className="text-stone-700 underline">
            Admin → Prompts
          </Link>{" "}
          (Companies).
        </p>
      </div>

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
    </div>
  );
}
