"use client";

import Link from "next/link";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";

export function LandingPage() {
  return (
    <div style={{ background: "#F7F5F2", minHeight: "100vh", fontFamily: "var(--font-ui), sans-serif" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-0.3px" }}>Kimchi</span>
          <KimchiBySecondLadder fontSize={13} style={{ marginLeft: 8, display: "inline-block" }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/pricing" style={{ fontSize: 14, color: "#52493F", textDecoration: "none", padding: "8px 16px" }}>Pricing</Link>
          <Link href="/login" style={{ fontSize: 14, color: "#52493F", textDecoration: "none", padding: "8px 16px" }}>Log in</Link>
          <Link href="/signup" style={{ fontSize: 14, color: "#F2EDE3", background: "#1C3A2F", borderRadius: 10, padding: "9px 20px", textDecoration: "none", fontWeight: 500 }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "96px 48px 80px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#1C3A2F18", border: "1px solid #1C3A2F30", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
          <span style={{ fontSize: 12, color: "#1C3A2F", fontWeight: 500, letterSpacing: "0.4px" }}>Job search workspace for senior roles</span>
        </div>
        <h1 style={{ margin: "0 0 20px", fontSize: 56, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-1.5px", lineHeight: 1.1, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          Run your search like someone who&apos;s done it before.
        </h1>
        <p style={{ margin: "0 0 40px", fontSize: 19, color: "#52493F", lineHeight: 1.65, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
          Upload your resume, track every role in one pipeline, and tailor cover letters and bullets from your real experience — not a generic template.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup" style={{ fontSize: 15, fontWeight: 600, color: "#F2EDE3", background: "#1C3A2F", borderRadius: 12, padding: "14px 32px", textDecoration: "none", display: "inline-block" }}>
            Start for free
          </Link>
          <Link href="/pricing" style={{ fontSize: 15, color: "#1C3A2F", background: "transparent", border: "1.5px solid #1C3A2F40", borderRadius: 12, padding: "14px 32px", textDecoration: "none", display: "inline-block" }}>
            See pricing
          </Link>
        </div>
        <p style={{ marginTop: 20, fontSize: 13, color: "var(--scout-muted)" }}>No credit card required to start.</p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 48px 96px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {[
          { icon: "📄", title: "Resume-aware AI", body: "Upload your resume once. Every tailored bullet point and cover letter is generated from your actual experience — not a generic template." },
          { icon: "🎯", title: "Fit analysis", body: "Paste a job URL and get an honest assessment of where you're strong, where you have gaps, and one concrete tip to stand out." },
          { icon: "📋", title: "Pipeline tracking", body: "Kanban board that tracks every role from Saved → Interviewing → Offer. Stage changes persist automatically." },
        ].map((f) => (
          <div key={f.title} style={{ background: "#FFFDF9", border: "1px solid #E5DDD0", borderRadius: 16, padding: "28px 28px 32px" }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600, color: "#1C3A2F" }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 14, color: "#52493F", lineHeight: 1.65 }}>{f.body}</p>
          </div>
        ))}
      </section>

      {/* Social proof strip */}
      <section style={{ background: "#1C3A2F", padding: "48px 48px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(232,213,163,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>Built for senior professionals</p>
          <p style={{ margin: 0, fontSize: 17, color: "#E8D5A3", lineHeight: 1.7 }}>
            Product Managers, Corporate Strategy, and Operations leaders targeting $150K–$400K roles.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "80px 48px 96px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 36, fontWeight: 600, color: "#1C3A2F", letterSpacing: "-0.8px", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          Ready to run a smarter search?
        </h2>
        <p style={{ margin: "0 0 36px", fontSize: 16, color: "#52493F", lineHeight: 1.65 }}>
          Upload your resume, add your first job, and see what tailored applications actually look like.
        </p>
        <Link href="/signup" style={{ fontSize: 15, fontWeight: 600, color: "#F2EDE3", background: "#1C3A2F", borderRadius: 12, padding: "14px 36px", textDecoration: "none", display: "inline-block" }}>
          Create your free workspace
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #E5DDD0", padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--scout-muted)" }}>© 2025 Second Ladder. All rights reserved.</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/pricing" style={{ fontSize: 13, color: "var(--scout-muted)", textDecoration: "none" }}>Pricing</Link>
          <Link href="/login" style={{ fontSize: 13, color: "var(--scout-muted)", textDecoration: "none" }}>Log in</Link>
        </div>
      </footer>
    </div>
  );
}
