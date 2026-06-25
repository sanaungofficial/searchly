"use client";

import { useEffect, useState } from "react";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontMono, type as T } from "@/lib/typography";
import { adminSectionLabel } from "@/app/(workspace)/admin/admin-styles";

type UsageResponse = {
  anthropic: {
    costThisMonth: number;
    callsThisMonth: number;
    tokensInThisMonth: number;
    tokensOutThisMonth: number;
    costTotal: number;
    callsTotal: number;
    byFeature: Array<{ feature: string; calls: number; costUsd: number }>;
    byModel: Array<{ model: string; calls: number; costUsd: number; tokensIn: number; tokensOut: number }>;
    dailyLast30Days: Array<{ date: string; calls: number; costUsd: number }>;
    topUsersThisMonth: Array<{ userId: string; name: string | null; email: string; calls: number; costUsd: number }>;
  };
  supabase: {
    authUsers: number;
    storage: {
      totalBytes: number;
      totalObjects: number;
      byBucket: Array<{ bucket: string; bytes: number; objects: number }>;
    };
    database: {
      users: number;
      profiles: number;
      jobs: number;
      assets: number;
      aiUsageLogs: number;
      companyIntel: number;
    };
    estimate: {
      planMonthlyUsd: number;
      includedStorageGb: number;
      storageUsedGb: number;
      storageOverageGb: number;
      storageOverageUsd: number;
      estimatedMonthlyUsd: number;
      note: string;
    };
  };
  generatedAt: string;
};

const FEATURE_LABELS: Record<string, string> = {
  COVER_LETTER: "Cover letter",
  FIT_ANALYSIS: "Fit analysis",
  RESUME_BULLETS: "Resume bullets",
  RESUME_PARSE: "Resume parse",
  JOB_PARSE: "Job parse",
  CHAT: "Scout chat",
  RESUME_TAILOR: "Resume tailor",
};

function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <ScoutBox padding="20px 24px">
      <p
        style={{
          fontSize: T.label,
          color: color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: fontMono,
          margin: "0 0 8px",
        }}
      >
        {label}
      </p>
      <p style={{ ...displayTitleStyle(28), color: accent ?? color.forest, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>{sub}</p>}
    </ScoutBox>
  );
}

function BreakdownTable({
  rows,
  columns,
}: {
  rows: Array<Record<string, string | number>>;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
}) {
  if (rows.length === 0) {
    return <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>No data yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.bodySm }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align ?? "left",
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(17,17,17,0.12)",
                  color: color.muted,
                  fontFamily: fontMono,
                  fontSize: T.caption,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid rgba(17,17,17,0.06)",
                    textAlign: col.align ?? "left",
                    fontFamily: col.align === "right" ? fontMono : undefined,
                    color: color.stone,
                  }}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailySpendChart({ days }: { days: UsageResponse["anthropic"]["dailyLast30Days"] }) {
  if (days.length === 0) {
    return <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>No AI calls in the last 30 days.</p>;
  }

  const maxCost = Math.max(...days.map((d) => d.costUsd), 0.0001);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 72, marginTop: 8 }}>
      {days.map((d) => {
        const h = Math.max(4, Math.round((d.costUsd / maxCost) * 64));
        return (
          <div
            key={d.date}
            title={`${d.date}: ${fmtUsd(d.costUsd)} (${d.calls} calls)`}
            style={{
              flex: 1,
              minWidth: 4,
              height: h,
              background: color.forest,
              opacity: d.costUsd > 0 ? 0.85 : 0.2,
            }}
          />
        );
      })}
    </div>
  );
}

export function AdminUsagePanel() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: UsageResponse) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className={adminSectionLabel}>API usage & costs</h2>
        <p style={{ fontSize: T.bodySm, color: color.muted }}>Loading usage data…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section>
        <h2 className={adminSectionLabel}>API usage & costs</h2>
        <ScoutBox padding="20px 24px">
          <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            Could not load usage stats. Check server logs.
          </p>
        </ScoutBox>
      </section>
    );
  }

  const { anthropic, supabase } = data;
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 className={adminSectionLabel} style={{ marginBottom: 0 }}>API usage & costs</h2>
        <p style={{ fontSize: T.caption, color: color.muted, fontFamily: fontMono, margin: 0 }}>
          Updated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Anthropic */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <ScoutLabel>Anthropic (Claude)</ScoutLabel>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
          <StatCard
            label={`Spend · ${monthLabel}`}
            value={fmtUsd(anthropic.costThisMonth)}
            sub={`${anthropic.callsThisMonth.toLocaleString()} API calls`}
            accent={anthropic.costThisMonth > 50 ? "#b45309" : color.forest}
          />
          <StatCard
            label="All-time spend"
            value={fmtUsd(anthropic.costTotal)}
            sub={`${anthropic.callsTotal.toLocaleString()} total calls`}
          />
          <StatCard
            label="Tokens in (month)"
            value={fmtTokens(anthropic.tokensInThisMonth)}
            sub="Input tokens"
          />
          <StatCard
            label="Tokens out (month)"
            value={fmtTokens(anthropic.tokensOutThisMonth)}
            sub="Output tokens"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <ScoutBox padding="20px 24px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 12px" }}>
              Daily spend (30 days)
            </p>
            <DailySpendChart days={anthropic.dailyLast30Days} />
          </ScoutBox>
          <ScoutBox padding="20px 24px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 12px" }}>
              Top users this month
            </p>
            <BreakdownTable
              rows={anthropic.topUsersThisMonth.map((u) => ({
                user: u.name ?? u.email.split("@")[0],
                email: u.email,
                calls: u.calls,
                cost: fmtUsd(u.costUsd),
              }))}
              columns={[
                { key: "user", label: "User" },
                { key: "calls", label: "Calls", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
              ]}
            />
          </ScoutBox>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScoutBox padding="20px 24px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 12px" }}>
              By feature
            </p>
            <BreakdownTable
              rows={anthropic.byFeature.map((f) => ({
                feature: FEATURE_LABELS[f.feature] ?? f.feature,
                calls: f.calls,
                cost: fmtUsd(f.costUsd),
              }))}
              columns={[
                { key: "feature", label: "Feature" },
                { key: "calls", label: "Calls", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
              ]}
            />
          </ScoutBox>
          <ScoutBox padding="20px 24px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 12px" }}>
              By model
            </p>
            <BreakdownTable
              rows={anthropic.byModel.map((m) => ({
                model: m.model.replace("claude-", "").slice(0, 24),
                tokens: `${fmtTokens(m.tokensIn)} / ${fmtTokens(m.tokensOut)}`,
                cost: fmtUsd(m.costUsd),
              }))}
              columns={[
                { key: "model", label: "Model" },
                { key: "tokens", label: "In / out", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
              ]}
            />
          </ScoutBox>
        </div>
        <p style={{ fontSize: T.caption, color: color.muted, marginTop: 12 }}>
          Costs are calculated from logged token usage in Kimchi. Compare with the{" "}
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" style={{ color: color.forest }}>
            Anthropic billing console
          </a>{" "}
          for authoritative totals.
        </p>
      </div>

      {/* Supabase */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <ScoutLabel>Supabase</ScoutLabel>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
          <StatCard
            label="Est. monthly cost"
            value={fmtUsd(supabase.estimate.estimatedMonthlyUsd)}
            sub={`Plan $${supabase.estimate.planMonthlyUsd}/mo`}
          />
          <StatCard
            label="Storage used"
            value={fmtBytes(supabase.storage.totalBytes)}
            sub={`${supabase.storage.totalObjects.toLocaleString()} objects`}
          />
          <StatCard
            label="Auth users"
            value={supabase.authUsers.toLocaleString()}
            sub="Supabase Auth accounts"
          />
          <StatCard
            label="DB rows (users)"
            value={supabase.database.users.toLocaleString()}
            sub={`${supabase.database.jobs.toLocaleString()} jobs · ${supabase.database.assets.toLocaleString()} assets`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScoutBox padding="20px 24px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 12px" }}>
              Storage by bucket
            </p>
            <BreakdownTable
              rows={supabase.storage.byBucket.map((b) => ({
                bucket: b.bucket,
                objects: b.objects,
                size: fmtBytes(b.bytes),
              }))}
              columns={[
                { key: "bucket", label: "Bucket" },
                { key: "objects", label: "Files", align: "right" },
                { key: "size", label: "Size", align: "right" },
              ]}
            />
          </ScoutBox>
          <ScoutBox padding="20px 24px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 12px" }}>
              Database counts
            </p>
            <BreakdownTable
              rows={[
                { table: "Users", count: supabase.database.users },
                { table: "Profiles", count: supabase.database.profiles },
                { table: "Jobs", count: supabase.database.jobs },
                { table: "Assets", count: supabase.database.assets },
                { table: "AI usage logs", count: supabase.database.aiUsageLogs },
                { table: "Company intel", count: supabase.database.companyIntel },
              ]}
              columns={[
                { key: "table", label: "Table" },
                { key: "count", label: "Rows", align: "right" },
              ]}
            />
          </ScoutBox>
        </div>
        <p style={{ fontSize: T.caption, color: color.muted, marginTop: 12 }}>
          {supabase.estimate.note}{" "}
          Storage overage: {supabase.estimate.storageOverageGb.toFixed(3)} GB beyond {supabase.estimate.includedStorageGb} GB included (
          {fmtUsd(supabase.estimate.storageOverageUsd)}).{" "}
          <a href="https://supabase.com/dashboard/project/_/settings/billing" target="_blank" rel="noreferrer" style={{ color: color.forest }}>
            Supabase billing dashboard
          </a>
        </p>
      </div>
    </section>
  );
}
