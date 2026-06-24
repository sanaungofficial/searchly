"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import {
  PRO_PLANS,
  PRO_FEATURE_ROWS,
  FREE_FOR_ALL_FEATURES,
  type BillingInterval,
} from "@/lib/plan-config";

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span style={{ color: "#4A8B6A", fontWeight: 700, fontSize: 18 }}>✓</span>
  ) : (
    <span style={{ color: "#C4574A", fontWeight: 700, fontSize: 18 }}>✕</span>
  );
}

export function PricingPageContent() {
  const [interval, setInterval] = useState<BillingInterval>("quarterly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { isPro, isAdmin, loading: subLoading, startCheckout, openPortal } = useSubscription();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setAuthLoading(false);
    });
  }, []);

  const plan = PRO_PLANS[interval];
  const proUser = isPro || isAdmin;

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isLoggedIn) {
        await startCheckout(interval);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/signup?next=/pricing`;
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#F7F5F2", minHeight: "100vh", fontFamily: "var(--font-ui), sans-serif" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <Link href={isLoggedIn ? "/dashboard" : "/"} style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1C3A2F" }}>Kimchi</span>
        </Link>
        <div style={{ display: "flex", gap: 12 }}>
          {authLoading ? null : isLoggedIn ? (
            <Link href="/dashboard" style={{ fontSize: 14, color: "#F2EDE3", background: "#1C3A2F", borderRadius: 10, padding: "9px 20px", textDecoration: "none", fontWeight: 500 }}>
              Open workspace
            </Link>
          ) : (
            <>
              <Link href="/login?next=/pricing" style={{ fontSize: 14, color: "#52493F", textDecoration: "none", padding: "8px 16px" }}>Log in</Link>
              <Link href="/signup?next=/pricing" style={{ fontSize: 14, color: "#F2EDE3", background: "#1C3A2F", borderRadius: 10, padding: "9px 20px", textDecoration: "none", fontWeight: 500 }}>Get started free</Link>
            </>
          )}
        </div>
      </nav>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 48px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 36, fontWeight: 700, color: "#1C3A2F", letterSpacing: "-0.5px" }}>
          Get 3x More Interviews with Kimchi Pro
        </h1>
        <p style={{ margin: "0 0 40px", fontSize: 16, color: "#52493F" }}>
          Stronger resumes + faster applications + live coach support — all less than $1 a day
        </p>

        {/* Billing interval cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 720, margin: "0 auto 48px" }}>
          {(Object.keys(PRO_PLANS) as BillingInterval[]).map((key) => {
            const p = PRO_PLANS[key];
            const selected = interval === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setInterval(key)}
                style={{
                  position: "relative",
                  background: selected ? (p.popular ? "#4A8B6A" : "#1C3A2F") : "#FFFDF9",
                  border: selected ? "2px solid #1C3A2F" : "1px solid #E5DDD0",
                  borderRadius: 14,
                  padding: "20px 16px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {p.popular && (
                  <span style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#4A8B6A", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    🔥 MOST POPULAR
                  </span>
                )}
                <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: selected ? "#E8D5A3" : "#52493F" }}>{p.label}</p>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: selected ? "#E8D5A3" : "#1C3A2F" }}>
                  ${p.price.toFixed(2)}
                </p>
                {p.compareAt && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: selected ? "rgba(232,213,163,0.6)" : "#8A7F72", textDecoration: "line-through" }}>
                    ${p.compareAt.toFixed(2)}
                  </p>
                )}
                {p.savePct && (
                  <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 700, color: selected ? "#1C3A2F" : "#4A8B6A", background: selected ? "#E8D5A3" : "rgba(74,139,106,0.12)", padding: "2px 8px", borderRadius: 20 }}>
                    Save {p.savePct}%
                  </span>
                )}
                {p.perMonthNote && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: selected ? "rgba(232,213,163,0.5)" : "#8A7F72" }}>{p.perMonthNote}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Pro + Free header row */}
        <div style={{ background: "#FFFDF9", border: "1px solid #E5DDD0", borderRadius: 16, overflow: "hidden", textAlign: "left" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", borderBottom: "1px solid #EEE9E2", background: "#FAFAF8" }}>
            <div style={{ padding: "16px 20px" }} />
            <div style={{ padding: "16px", textAlign: "center", borderLeft: "1px solid #EEE9E2" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#1C3A2F" }}>KIMCHI PRO</p>
              {proUser ? (
                <button type="button" onClick={() => openPortal()} style={{ width: "100%", padding: "10px", background: "#1C3A2F", color: "#E8D5A3", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  Manage billing
                </button>
              ) : (
                <button type="button" onClick={handleUpgrade} disabled={loading || subLoading} style={{ width: "100%", padding: "10px", background: "#1C3A2F", color: "#E8D5A3", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  {loading ? "Redirecting…" : "Upgrade Now"}
                </button>
              )}
            </div>
            <div style={{ padding: "16px", textAlign: "center", borderLeft: "1px solid #EEE9E2" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#52493F" }}>FREE PLAN</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1C3A2F" }}>$0.00</p>
              {isLoggedIn && !proUser && (
                <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, color: "#4A8B6A", background: "rgba(74,139,106,0.12)", padding: "3px 10px", borderRadius: 20 }}>
                  Your Current Plan
                </span>
              )}
            </div>
          </div>

          {PRO_FEATURE_ROWS.map((row) => (
            <div key={row.name} style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", borderBottom: "1px solid #EEE9E2", alignItems: "center" }}>
              <div style={{ padding: "14px 20px" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1C3A2F" }}>{row.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8A7F72" }}>{row.description}</p>
              </div>
              <div style={{ padding: "14px", textAlign: "center", borderLeft: "1px solid #EEE9E2", fontSize: 13, fontWeight: 600, color: "#1C3A2F" }}>
                {row.pro === "check" ? <CheckIcon ok /> : row.pro}
              </div>
              <div style={{ padding: "14px", textAlign: "center", borderLeft: "1px solid #EEE9E2", fontSize: 13, color: "#52493F" }}>
                {row.free === "check" ? <CheckIcon ok /> : row.free === "x" ? <CheckIcon ok={false} /> : row.free}
              </div>
            </div>
          ))}
        </div>

        {error && <p style={{ marginTop: 16, color: "#C4574A", fontSize: 14 }}>{error}</p>}

        {/* Accessible to all */}
        <div style={{ marginTop: 48, textAlign: "left", background: "#FFFDF9", border: "1px solid #E5DDD0", borderRadius: 16, padding: "24px 28px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#1C3A2F" }}>Accessible to All Plans</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {FREE_FOR_ALL_FEATURES.map((f) => (
              <p key={f} style={{ margin: 0, fontSize: 14, color: "#52493F", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#4A8B6A", fontWeight: 700 }}>✓</span> {f}
              </p>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #E5DDD0", padding: "24px 48px", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "var(--scout-muted)" }}>Questions? Reply to any email from us.</span>
      </footer>
    </div>
  );
}
