"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PricingPanel } from "./pricing-panel";

/** Full-page pricing for marketing / logged-out visitors. In-app uses PricingModal. */
export function PricingPageContent() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setAuthLoading(false);
    });
  }, []);

  return (
    <div className="bruddle" style={{ background: "var(--scout-page)", minHeight: "100vh", fontFamily: "var(--font-ui), sans-serif" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 48px",
          borderBottom: "var(--scout-border)",
        }}
      >
        <Link href={isLoggedIn ? "/dashboard" : "/"} style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1C3A2F" }}>Kimchi</span>
        </Link>
        <div style={{ display: "flex", gap: 12 }}>
          {authLoading ? null : isLoggedIn ? (
            <Link
              href="/dashboard?pricing=1"
              style={{
                fontSize: 14,
                color: "var(--scout-cta-foreground)",
                background: "var(--scout-cta)",
                border: "var(--scout-border)",
                boxShadow: "var(--scout-shadow-bruddle)",
                borderRadius: "var(--scout-radius)",
                padding: "9px 20px",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              View plans in app
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/dashboard?pricing=1"
                style={{ fontSize: 14, color: "#52493F", textDecoration: "none", padding: "8px 16px" }}
              >
                Log in
              </Link>
              <Link
                href="/signup?next=/dashboard?pricing=1"
                style={{
                  fontSize: 14,
                  color: "var(--scout-cta-foreground)",
                  background: "var(--scout-cta)",
                  border: "var(--scout-border)",
                  boxShadow: "var(--scout-shadow-bruddle)",
                  borderRadius: "var(--scout-radius)",
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

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 48px" }}>
        <PricingPanel />
      </section>

      <footer style={{ borderTop: "var(--scout-border)", padding: "24px 48px", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "var(--scout-muted)" }}>Questions? Reply to any email from us.</span>
      </footer>
    </div>
  );
}
