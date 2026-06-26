"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachingPurchaseDrawer } from "@/components/admin/coaching-purchase-drawer";
import { ScoutBox } from "@/components/scout/scout-box";
import { formatUsdFromCents } from "@/lib/coach-pricing";
import { formatPurchaseLeadSource, formatPurchaseStatus, type AdminPurchaseRow } from "@/lib/coach-purchase";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type Stats = {
  totalVolumeCents: number;
  totalPurchases: number;
  monthVolumeCents: number;
  monthPurchases: number;
  platformRevenueCents: number;
  coachPayoutsCents: number;
  refundCount: number;
};

function PurchasesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [purchases, setPurchases] = useState<AdminPurchaseRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [salesAssisted, setSalesAssisted] = useState(searchParams.get("salesAssisted") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("purchaseId"));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (salesAssisted) params.set("salesAssisted", salesAssisted);
    try {
      const r = await fetch(`/api/admin/purchases?${params.toString()}`);
      if (!r.ok) throw new Error("Failed to load purchases");
      const data = await r.json();
      setPurchases(data.purchases ?? []);
      setStats(data.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [q, status, salesAssisted]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => purchases.find((p) => p.id === selectedId) ?? null,
    [purchases, selectedId],
  );

  function openPurchase(id: string) {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("purchaseId", id);
    router.replace(`/admin/purchases?${params.toString()}`, { scroll: false });
  }

  function closePurchase() {
    setSelectedId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("purchaseId");
    const qs = params.toString();
    router.replace(qs ? `/admin/purchases?${qs}` : "/admin/purchases", { scroll: false });
  }

  return (
    <div>
      <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>Purchases</h1>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 24px", maxWidth: 720, lineHeight: 1.55 }}>
        Coaching package purchases through Kimchi checkout. Track client spend, platform fees, coach payouts, and refunds — similar to Leland&apos;s purchases dashboard.
      </p>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total volume", value: formatUsdFromCents(stats.totalVolumeCents) ?? "$0" },
            { label: "Purchases", value: String(stats.totalPurchases) },
            { label: "This month", value: formatUsdFromCents(stats.monthVolumeCents) ?? "$0" },
            { label: "Platform revenue", value: formatUsdFromCents(stats.platformRevenueCents) ?? "$0" },
            { label: "Coach payouts", value: formatUsdFromCents(stats.coachPayoutsCents) ?? "$0" },
            { label: "Refunds", value: String(stats.refundCount) },
          ].map(({ label, value }) => (
            <ScoutBox key={label} padding="14px 16px">
              <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                {label}
              </p>
              <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 22, fontWeight: 600 }}>{value}</p>
            </ScoutBox>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search client, coach, package…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 220px", minWidth: 200, padding: "9px 12px", border: border.line, fontFamily: fontSans, fontSize: 14 }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: "9px 12px", border: border.line, fontFamily: fontSans, fontSize: 14, background: "#fff" }}
        >
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partial refund</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELED">Canceled</option>
        </select>
        <select
          value={salesAssisted}
          onChange={(e) => setSalesAssisted(e.target.value)}
          style={{ padding: "9px 12px", border: border.line, fontFamily: fontSans, fontSize: 14, background: "#fff" }}
        >
          <option value="">All lead sources</option>
          <option value="true">Sales assisted</option>
          <option value="false">Not sales assisted</option>
        </select>
      </div>

      {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading purchases…</p>}
      {error && <p style={{ fontFamily: fontSans, color: "#dc2626" }}>{error}</p>}

      {!loading && !error && purchases.length === 0 && (
        <ScoutBox padding={24}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 15, color: color.muted, lineHeight: 1.6 }}>
            No purchases yet. When clients buy coaching packages through Stripe checkout, they will appear here with fee breakdowns and hour balances.
          </p>
        </ScoutBox>
      )}

      {!loading && purchases.length > 0 && (
        <div style={{ border: border.line, background: surface.card, overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 1fr 1.2fr 80px 100px 100px 100px 90px",
              gap: 12,
              padding: "12px 16px",
              borderBottom: border.line,
              fontFamily: fontMono,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: color.muted,
              minWidth: 980,
            }}
          >
            <span>Date</span>
            <span>Client</span>
            <span>Coach</span>
            <span>Package</span>
            <span>Hours</span>
            <span>Amount</span>
            <span>Coach gets</span>
            <span>Source</span>
            <span>Status</span>
          </div>
          {purchases.map((p) => {
            const date = new Date(p.paidAt ?? p.createdAt);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openPurchase(p.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 1fr 1.2fr 80px 100px 100px 100px 90px",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: border.line,
                  background: selectedId === p.id ? "rgba(45,122,80,0.04)" : "transparent",
                  border: "none",
                  borderBottomWidth: 1,
                  borderBottomStyle: "solid",
                  borderBottomColor: "rgba(26,58,47,0.08)",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  minWidth: 980,
                }}
              >
                <span style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>
                  {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                </span>
                <span>
                  <span style={{ display: "block", fontFamily: fontSans, fontSize: 14, fontWeight: 500 }}>{p.buyerName ?? "—"}</span>
                  {p.buyerEmail && (
                    <span style={{ display: "block", fontFamily: fontSans, fontSize: 12, color: color.muted }}>{p.buyerEmail}</span>
                  )}
                </span>
                <span style={{ fontFamily: fontSans, fontSize: 14 }}>{p.coachName}</span>
                <span style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>{p.packageTitle}</span>
                <span style={{ fontFamily: fontMono, fontSize: 12 }}>{p.hoursRemaining}/{p.hoursGranted}h</span>
                <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>{formatUsdFromCents(p.amountCents)}</span>
                <span style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}>{formatUsdFromCents(p.coachPayoutCents)}</span>
                <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                  {p.salesAssisted ? "Sales" : formatPurchaseLeadSource(p.leadSource).split(" ")[0]}
                </span>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    color: p.status === "PAID" ? color.forest : p.status === "REFUNDED" ? "#dc2626" : color.muted,
                  }}
                >
                  {formatPurchaseStatus(p.status)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && <CoachingPurchaseDrawer purchase={selected} onClose={closePurchase} />}
    </div>
  );
}

export default function AdminPurchasesPage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 style={{ ...displayTitleStyle(28), margin: "0 0 20px" }}>Purchases</h1>
          <p style={{ fontFamily: fontSans, color: color.muted }}>Loading purchases…</p>
        </div>
      }
    >
      <PurchasesInner />
    </Suspense>
  );
}
