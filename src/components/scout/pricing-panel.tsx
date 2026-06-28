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
import { bruddleHeadingStyle, color, fontSans, radius, type as T } from "@/lib/typography";

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span style={{ color: color.forest, fontWeight: 700, fontSize: 16 }}>✓</span>
  ) : (
    <span style={{ color: "#C4574A", fontWeight: 700, fontSize: 16 }}>✕</span>
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

  const btnStyle = {
    width: "100%" as const,
    padding: "10px 12px",
    background: color.cta,
    color: color.ctaForeground,
    border: "var(--scout-border)",
    borderRadius: radius.px,
    boxShadow: "var(--scout-shadow-bruddle)",
    fontFamily: fontSans,
    fontWeight: 600,
    cursor: "pointer" as const,
    fontSize: T.btnSm,
  };

  return (
    <div style={{ fontFamily: fontSans }}>
      <div style={{ textAlign: "center", marginBottom: compact ? 24 : 40 }}>
        <h2 style={{ ...bruddleHeadingStyle(compact ? "h4" : "h3"), color: color.forest, marginBottom: 8 }}>
          Kimchi Pro — unlimited AI for your search
        </h2>
        <p style={{ margin: 0, fontSize: compact ? T.bodySm : T.body, color: color.stone, lineHeight: 1.55 }}>
          Match analysis, tailoring, cover letters, and Scout with no credit limits. Coaching access included.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
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
                background: selected ? color.forest : "#FFFFFF",
                border: selected ? "var(--scout-border)" : "var(--scout-border)",
                borderRadius: radius.px,
                padding: compact ? "16px 12px" : "20px 16px",
                cursor: "pointer",
                textAlign: "center",
                boxShadow: selected ? "3px 3px 0 #161616" : undefined,
              }}
            >
              {p.popular && (
                <span
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: color.forest,
                    color: color.gold,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 10px",
                    border: "var(--scout-border)",
                    borderRadius: radius.px,
                    whiteSpace: "nowrap",
                  }}
                >
                  Most popular
                </span>
              )}
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  color: selected ? color.gold : color.stone,
                }}
              >
                {p.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: fontSans,
                  fontSize: compact ? 22 : 28,
                  fontWeight: 700,
                  color: selected ? color.gold : color.forest,
                }}
              >
                ${p.price.toFixed(2)}
              </p>
              {p.compareAt && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: T.label,
                    color: selected ? "rgba(232,213,163,0.6)" : color.mutedLight,
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
                    color: selected ? color.forest : color.forest,
                    background: selected ? color.gold : "rgba(26,58,47,0.08)",
                    padding: "2px 8px",
                    border: selected ? "var(--scout-border)" : "none",
                    borderRadius: radius.px,
                  }}
                >
                  Save {p.savePct}%
                </span>
              )}
              {p.perMonthNote && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 10,
                    color: selected ? "rgba(232,213,163,0.55)" : color.mutedLight,
                  }}
                >
                  {p.perMonthNote}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "var(--scout-border)",
          borderRadius: radius.px,
          overflow: "hidden",
          textAlign: "left",
          boxShadow: "3px 3px 0 #161616",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr 120px 120px" : "1fr 180px 180px",
            borderBottom: "var(--scout-border)",
            background: "#FAF4F0",
          }}
        >
          <div style={{ padding: compact ? "12px 16px" : "16px 20px" }} />
          <div style={{ padding: "12px", textAlign: "center", borderLeft: "var(--scout-border)" }}>
            <p style={{ margin: "0 0 8px", fontSize: T.label, fontWeight: 700, color: color.forest, letterSpacing: "0.04em" }}>
              KIMCHI PRO
            </p>
            {proUser ? (
              <button type="button" onClick={() => openPortal()} style={btnStyle}>
                Manage billing
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={loading || subLoading || authLoading}
                style={{ ...btnStyle, opacity: loading || subLoading || authLoading ? 0.7 : 1 }}
              >
                {loading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            )}
          </div>
          <div style={{ padding: "12px", textAlign: "center", borderLeft: "var(--scout-border)" }}>
            <p style={{ margin: "0 0 8px", fontSize: T.label, fontWeight: 700, color: color.stone, letterSpacing: "0.04em" }}>
              FREE PLAN
            </p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: color.forest }}>$0.00</p>
            {isLoggedIn && !proUser && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: color.forest,
                  background: "rgba(26,58,47,0.08)",
                  padding: "3px 8px",
                  border: "var(--scout-border)",
                  borderRadius: radius.px,
                }}
              >
                Your current plan
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
              borderBottom: "var(--scout-border)",
              alignItems: "center",
            }}
          >
            <div style={{ padding: compact ? "10px 16px" : "14px 20px" }}>
              <p style={{ margin: 0, fontSize: T.bodySm, fontWeight: 600, color: "#161616" }}>{row.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: T.label, color: color.muted }}>{row.description}</p>
            </div>
            <div
              style={{
                padding: "10px",
                textAlign: "center",
                borderLeft: "var(--scout-border)",
                fontSize: T.bodySm,
                fontWeight: 600,
                color: color.forest,
              }}
            >
              {row.pro === "check" ? <CheckIcon ok /> : row.pro}
            </div>
            <div
              style={{
                padding: "10px",
                textAlign: "center",
                borderLeft: "var(--scout-border)",
                fontSize: T.bodySm,
                color: color.stone,
              }}
            >
              {row.free === "check" ? <CheckIcon ok /> : row.free === "x" ? <CheckIcon ok={false} /> : row.free}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p style={{ marginTop: 12, color: "#C4574A", fontSize: T.bodySm, textAlign: "center" }}>{error}</p>
      )}

      <div
        style={{
          marginTop: compact ? 24 : 48,
          textAlign: "left",
          background: "#FFFFFF",
          border: "var(--scout-border)",
          borderRadius: radius.px,
          padding: compact ? "16px 20px" : "24px 28px",
          boxShadow: "3px 3px 0 #161616",
        }}
      >
        <p style={{ ...bruddleHeadingStyle("h6"), color: color.forest, marginBottom: 12 }}>Included on every plan</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {FREE_FOR_ALL_FEATURES.map((f) => (
            <p
              key={f}
              style={{
                margin: 0,
                fontSize: T.bodySm,
                color: color.stone,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span style={{ color: color.forest, fontWeight: 700 }}>✓</span> {f}
            </p>
          ))}
        </div>
      </div>

      {!isLoggedIn && !authLoading && !compact && (
        <p style={{ marginTop: 20, textAlign: "center", fontSize: T.bodySm, color: color.stone }}>
          Already have an account?{" "}
          <Link href="/login?next=/dashboard?pricing=1" style={{ color: color.forest, fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}
