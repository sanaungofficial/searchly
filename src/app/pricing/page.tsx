"use client";

import Link from "next/link";
import { useState } from "react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
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

  return (
    <div style={{ background: "#F2EDE3", minHeight: "100vh", fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-0.3px" }}>Kimchi</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: 14, color: "#52493F", textDecoration: "none", padding: "8px 16px" }}>Log in</Link>
          <Link href="/signup" style={{ fontSize: 14, color: "#F2EDE3", background: "#1C3A2F", borderRadius: 10, padding: "9px 20px", textDecoration: "none", fontWeight: 500 }}>
            Get started free
          </Link>
        </div>
      </nav>

      <section style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px 96px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 40, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-1px", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          Simple pricing
        </h1>
        <p style={{ margin: "0 0 56px", fontSize: 16, color: "#52493F" }}>
          One plan. Everything included.
        </p>

        {/* Free tier */}
        <div style={{ background: "#FFFDF9", border: "1px solid #E5DDD0", borderRadius: 20, padding: "36px 36px 32px", marginBottom: 16, textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "#1C3A2F" }}>Free</p>
              <p style={{ margin: 0, fontSize: 13, color: "#A09890" }}>No card required</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: "#1C3A2F" }}>$0</span>
            </div>
          </div>
          <ul style={{ margin: "0 0 28px", padding: "0 0 0 18px", listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {["Resume upload + AI extraction", "Scout chat (5 messages/day)", "Job pipeline tracking (up to 10 jobs)", "1 AI tool run per job"].map((f) => (
              <li key={f} style={{ fontSize: 14, color: "#52493F", display: "flex", gap: 10, alignItems: "flex-start", paddingLeft: 0 }}>
                <span style={{ color: "#4A8B6A", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <Link href="/signup" style={{ display: "block", textAlign: "center", padding: "12px", border: "1.5px solid #1C3A2F40", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "#1C3A2F", textDecoration: "none" }}>
            Start for free
          </Link>
        </div>

        {/* Pro tier */}
        <div style={{ background: "#1C3A2F", border: "1px solid #1C3A2F", borderRadius: 20, padding: "36px 36px 32px", textAlign: "left", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 16, right: 20, background: "#E8D5A3", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#1C3A2F", letterSpacing: "0.5px", textTransform: "uppercase" }}>
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
          <ul style={{ margin: "0 0 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
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
          <button
            onClick={startCheckout}
            disabled={loading}
            style={{ display: "block", width: "100%", padding: "13px", background: "#E8D5A3", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#1C3A2F", border: "none", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #E5DDD0", padding: "24px 48px", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#A09890" }}>Questions? Reply to any email from us.</span>
      </footer>
    </div>
  );
}
