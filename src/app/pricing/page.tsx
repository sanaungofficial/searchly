"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { CREDIT_ACTIONS, FREE_MONTHLY_CREDITS } from "@/lib/credits";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

export default function PricingPage() {
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

  const startProCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isLoggedIn) {
        await startCheckout();
        setLoading(false);
        return;
      }
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/signup?next=/pricing";
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

  const proUser = isPro || isAdmin;

  const navBtn: React.CSSProperties = {
    fontSize: T.bodySm,
    color: color.gold,
    background: color.forest,
    borderRadius: 0,
    padding: "9px 20px",
    textDecoration: "none",
    fontWeight: 600,
    fontFamily: fontSans,
  };

  const tierCard: React.CSSProperties = {
    background: surface.card,
    border: border.line,
    borderRadius: 0,
    padding: "36px 36px 32px",
    display: "flex",
    flexDirection: "column",
  };

  const outlineBtn: React.CSSProperties = {
    display: "block",
    textAlign: "center",
    padding: "12px",
    border: border.lineStrong,
    borderRadius: 0,
    fontSize: T.bodySm,
    fontWeight: 600,
    color: color.forest,
    textDecoration: "none",
    fontFamily: fontSans,
  };

  return (
    <div style={{ background: surface.page, minHeight: "100vh", fontFamily: fontSans }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: border.line }}>
        <Link href={isLoggedIn ? "/dashboard" : "/"} style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: color.forest, letterSpacing: "-0.3px" }}>Kimchi</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {authLoading ? null : isLoggedIn ? (
            <Link href="/dashboard" style={navBtn}>
              Open workspace
            </Link>
          ) : (
            <>
              <Link href="/login?next=/pricing" style={{ fontSize: T.bodySm, color: color.stone, textDecoration: "none", padding: "8px 16px" }}>
                Log in
              </Link>
              <Link href="/signup?next=/pricing" style={navBtn}>
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 96px", textAlign: "center" }}>
        <h1 style={displayTitleStyle(40, { marginBottom: 12, color: color.forest })}>
          Simple pricing
        </h1>
        <p style={{ margin: "0 0 56px", fontSize: T.body, color: color.stone }}>
          One plan. Everything included.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            alignItems: "stretch",
            textAlign: "left",
          }}
        >
          {/* Free tier */}
          <div style={tierCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: T.heading, fontWeight: 600, color: color.forest }}>Free</p>
                <p style={{ margin: 0, fontSize: T.caption, color: color.muted }}>No card required</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: color.forest, fontFamily: fontSans }}>$0</span>
              </div>
            </div>
            <ul style={{ margin: "0 0 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[
                "Resume upload + AI extraction",
                `${FREE_MONTHLY_CREDITS} AI credits per month`,
                "Job pipeline tracking",
                "Scout chat",
              ].map((f) => (
                <li key={f} style={{ fontSize: T.bodySm, color: color.stone, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: color.forest, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <p style={{ margin: "0 0 20px", fontSize: T.label, color: color.muted, lineHeight: 1.55 }}>
              1 credit per AI action — {CREDIT_ACTIONS.slice(0, 3).join(", ").toLowerCase()}, and more.
            </p>
            {isLoggedIn && !proUser ? (
              <div
                style={{
                  ...outlineBtn,
                  color: color.muted,
                  background: surface.page,
                  cursor: "default",
                }}
              >
                Your current plan
              </div>
            ) : isLoggedIn && proUser ? (
              <Link href="/dashboard" style={outlineBtn}>
                Go to dashboard
              </Link>
            ) : (
              <Link href="/signup?next=/pricing" style={outlineBtn}>
                Start for free
              </Link>
            )}
          </div>

          {/* Pro tier */}
          <div style={{ ...tierCard, background: color.forest, border: `1px solid ${color.forest}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 16, right: 20, background: color.gold, borderRadius: 0, padding: "4px 12px", fontSize: T.label, fontWeight: 700, color: color.forest, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Most popular
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: T.heading, fontWeight: 600, color: color.gold }}>Pro</p>
                <p style={{ margin: 0, fontSize: T.caption, color: "rgba(232,213,163,0.5)" }}>Billed monthly</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: color.gold, fontFamily: fontSans }}>$29</span>
                <span style={{ fontSize: T.bodySm, color: "rgba(232,213,163,0.5)", marginLeft: 4 }}>/mo</span>
              </div>
            </div>
            <ul style={{ margin: "0 0 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[
                "Everything in Free",
                "Unlimited AI credits",
                "Unlimited Scout chat",
                "Unlimited job tracking",
                "Resume bullet tailoring per job",
                "Cover letter generation",
                "Fit analysis with gap report",
                "Priority support",
              ].map((f) => (
                <li key={f} style={{ fontSize: T.bodySm, color: color.gold, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "rgba(232,213,163,0.85)", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {error && (
              <p style={{ margin: "0 0 12px", fontSize: T.caption, color: "#E8A3A3", textAlign: "center" }}>{error}</p>
            )}
            {proUser ? (
              <button
                onClick={() => openPortal()}
                disabled={subLoading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "13px",
                  background: color.gold,
                  borderRadius: 0,
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  color: color.forest,
                  border: "none",
                  cursor: subLoading ? "default" : "pointer",
                  opacity: subLoading ? 0.7 : 1,
                  marginTop: "auto",
                  fontFamily: fontSans,
                }}
              >
                Manage billing
              </button>
            ) : (
              <button
                onClick={startProCheckout}
                disabled={loading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "13px",
                  background: color.gold,
                  borderRadius: 0,
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  color: color.forest,
                  border: "none",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  marginTop: "auto",
                  fontFamily: fontSans,
                }}
              >
                {loading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            )}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: border.line, padding: "24px 48px", textAlign: "center" }}>
        <span style={{ fontSize: T.caption, color: color.muted }}>Questions? Reply to any email from us.</span>
      </footer>
    </div>
  );
}
