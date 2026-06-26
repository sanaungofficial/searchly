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

type Props = {
  /** Tighter layout for modal vs marketing page */
  compact?: boolean;
};

export function PricingPanel({ compact = false }: Props) {
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
          window.location.href = `/signup?next=/dashboard?pricing=1`;
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
    <div style={{ fontFamily: "var(--font-ui), sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: compact ? 24 : 40 }}>
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: compact ? 22 : 36,
            fontWeight: 700,
            color: "#1C3A2F",
            letterSpacing: "-0.5px",
          }}
        >
          Kimchi Pro — unlimited AI for your search
        </h2>
        <p style={{ margin: 0, fontSize: compact ? 14 : 16, color: "#52493F" }}>
          Match analysis, tailoring, cover letters, and Scout with no credit limits. Coaching access included.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "repeat(3, 1fr)" : "repeat(3, 1fr)",
          gap: 10,
          maxWidth: 720,
          margin: "0 auto 32px",
        }}
      >
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
                borderRadius: "var(--scout-radius)",
                padding: compact ? "16px 12px" : "20px 16px",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {p.popular && (
                <span
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#4A8B6A",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    whiteSpace: "nowrap",
                  }}
                >
                  🔥 MOST POPULAR
                </span>
              )}
              <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: selected ? "#E8D5A3" : "#52493F" }}>
                {p.label}
              </p>
              <p style={{ margin: 0, fontSize: compact ? 22 : 28, fontWeight: 700, color: selected ? "#E8D5A3" : "#1C3A2F" }}>
                ${p.price.toFixed(2)}
              </p>
              {p.compareAt && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    color: selected ? "rgba(232,213,163,0.6)" : "#8A7F72",
                    textDecoration: "line-through",
                  }}
                >
                  ${p.compareAt.toFixed(2)}
                </p>
              )}
              {p.savePct && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    color: selected ? "#1C3A2F" : "#4A8B6A",
                    background: selected ? "#E8D5A3" : "rgba(74,139,106,0.12)",
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  Save {p.savePct}%
                </span>
              )}
              {p.perMonthNote && (
                <p style={{ margin: "6px 0 0", fontSize: 10, color: selected ? "rgba(232,213,163,0.5)" : "#8A7F72" }}>
                  {p.perMonthNote}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          background: "#FFFDF9",
          border: "1px solid #E5DDD0",
          borderRadius: "var(--scout-radius)",
          overflow: "hidden",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr 120px 120px" : "1fr 180px 180px",
            borderBottom: "1px solid #EEE9E2",
            background: "#FAFAF8",
          }}
        >
          <div style={{ padding: compact ? "12px 16px" : "16px 20px" }} />
          <div style={{ padding: "12px", textAlign: "center", borderLeft: "1px solid #EEE9E2" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#1C3A2F" }}>KIMCHI PRO</p>
            {proUser ? (
              <button
                type="button"
                onClick={() => openPortal()}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "#1C3A2F",
                  color: "#E8D5A3",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Manage billing
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={loading || subLoading || authLoading}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "#1C3A2F",
                  color: "#E8D5A3",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {loading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            )}
          </div>
          <div style={{ padding: "12px", textAlign: "center", borderLeft: "1px solid #EEE9E2" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#52493F" }}>FREE PLAN</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1C3A2F" }}>$0.00</p>
            {isLoggedIn && !proUser && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#4A8B6A",
                  background: "rgba(74,139,106,0.12)",
                  padding: "3px 8px",
                  borderRadius: 20,
                }}
              >
                Your Current Plan
              </span>
            )}
          </div>
        </div>

        {PRO_FEATURE_ROWS.map((row) => (
          <div
            key={row.name}
            style={{
              display: "grid",
              gridTemplateColumns: compact ? "1fr 120px 120px" : "1fr 180px 180px",
              borderBottom: "1px solid #EEE9E2",
              alignItems: "center",
            }}
          >
            <div style={{ padding: compact ? "10px 16px" : "14px 20px" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1C3A2F" }}>{row.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8A7F72" }}>{row.description}</p>
            </div>
            <div
              style={{
                padding: "10px",
                textAlign: "center",
                borderLeft: "1px solid #EEE9E2",
                fontSize: 12,
                fontWeight: 600,
                color: "#1C3A2F",
              }}
            >
              {row.pro === "check" ? <CheckIcon ok /> : row.pro}
            </div>
            <div
              style={{
                padding: "10px",
                textAlign: "center",
                borderLeft: "1px solid #EEE9E2",
                fontSize: 12,
                color: "#52493F",
              }}
            >
              {row.free === "check" ? <CheckIcon ok /> : row.free === "x" ? <CheckIcon ok={false} /> : row.free}
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ marginTop: 12, color: "#C4574A", fontSize: 13, textAlign: "center" }}>{error}</p>}

      <div
        style={{
          marginTop: compact ? 24 : 48,
          textAlign: "left",
          background: "#FFFDF9",
          border: "1px solid #E5DDD0",
          borderRadius: "var(--scout-radius)",
          padding: compact ? "16px 20px" : "24px 28px",
        }}
      >
        <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#1C3A2F" }}>Included on every plan</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {FREE_FOR_ALL_FEATURES.map((f) => (
            <p key={f} style={{ margin: 0, fontSize: 13, color: "#52493F", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#4A8B6A", fontWeight: 700 }}>✓</span> {f}
            </p>
          ))}
        </div>
      </div>

      {!isLoggedIn && !authLoading && !compact && (
        <p style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "#52493F" }}>
          Already have an account?{" "}
          <Link href="/login?next=/dashboard?pricing=1" style={{ color: "#1C3A2F", fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}
