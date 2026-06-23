"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

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

  return (
    <div style={{ background: "#F7F5F2", minHeight: "100vh", fontFamily: "var(--font-ui), sans-serif" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <Link href={isLoggedIn ? "/dashboard" : "/"} style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-0.3px" }}>Kimchi</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {authLoading ? null : isLoggedIn ? (
            <Link
              href="/dashboard"
              style={{
                fontSize: 14,
                color: "#F2EDE3",
                background: "#1C3A2F",
                borderRadius: 10,
                padding: "9px 20px",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Open workspace
            </Link>
          ) : (
            <>
              <Link href="/login?next=/pricing" style={{ fontSize: 14, color: "#52493F", textDecoration: "none", padding: "8px 16px" }}>
                Log in
              </Link>
              <Link
                href="/signup?next=/pricing"
                style={{
                  fontSize: 14,
                  color: "#F2EDE3",
                  background: "#1C3A2F",
                  borderRadius: 10,
                  padding: "9px 20px",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 96px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 40, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-1px", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          Simple pricing
        </h1>
        <p style={{ margin: "0 0 56px", fontSize: 16, color: "#52493F" }}>
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
          <div style={{ background: "#FFFDF9", border: "1px solid #E5DDD0", borderRadius: 20, padding: "36px 36px 32px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "#1C3A2F" }}>Free</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--scout-muted)" }}>No card required</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: "#1C3A2F" }}>$0</span>
              </div>
            </div>
            <ul style={{ margin: "0 0 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {["Resume upload + AI extraction", "10 AI runs per month", "Job pipeline tracking", "Scout chat"].map((f) => (
                <li key={f} style={{ fontSize: 14, color: "#52493F", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#4A8B6A", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {isLoggedIn && !proUser ? (
              <div
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px",
                  border: "1.5px solid #1C3A2F20",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--scout-muted)",
                  background: "#F7F5F2",
                }}
              >
                Your current plan
              </div>
            ) : isLoggedIn && proUser ? (
              <Link
                href="/dashboard"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px",
                  border: "1.5px solid #1C3A2F40",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#1C3A2F",
                  textDecoration: "none",
                }}
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/signup?next=/pricing"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px",
                  border: "1.5px solid #1C3A2F40",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#1C3A2F",
                  textDecoration: "none",
                }}
              >
                Start for free
              </Link>
            )}
          </div>

          {/* Pro tier */}
          <div style={{ background: "#1C3A2F", border: "1px solid #1C3A2F", borderRadius: 20, padding: "36px 36px 32px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "absolute", top: 16, right: 20, background: "#E8D5A3", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#1C3A2F", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Most popular
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "#E8D5A3" }}>Pro</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(232,213,163,0.5)" }}>Billed monthly</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: "#E8D5A3" }}>$29</span>
                <span style={{ fontSize: 14, color: "rgba(232,213,163,0.5)", marginLeft: 4 }}>/mo</span>
              </div>
            </div>
            <ul style={{ margin: "0 0 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[
                "Everything in Free",
                "Unlimited Scout chat",
                "Unlimited job tracking",
                "Unlimited AI tool runs",
                "Resume bullet tailoring per job",
                "Cover letter generation",
                "Fit analysis with gap report",
                "Priority support",
              ].map((f) => (
                <li key={f} style={{ fontSize: 14, color: "#E8D5A3", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#4A8B6A", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {error && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#E8A3A3", textAlign: "center" }}>{error}</p>
            )}
            {proUser ? (
              <button
                onClick={() => openPortal()}
                disabled={subLoading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "13px",
                  background: "#E8D5A3",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1C3A2F",
                  border: "none",
                  cursor: subLoading ? "default" : "pointer",
                  opacity: subLoading ? 0.7 : 1,
                  marginTop: "auto",
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
                  background: "#E8D5A3",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1C3A2F",
                  border: "none",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  marginTop: "auto",
                }}
              >
                {loading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            )}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #E5DDD0", padding: "24px 48px", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "var(--scout-muted)" }}>Questions? Reply to any email from us.</span>
      </footer>
    </div>
  );
}
