import Link from "next/link";
import { bruddleHeadingStyle, color, fontSans, surface } from "@/lib/typography";

export default function PublicLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bruddle"
      style={{ minHeight: "100vh", background: surface.page, display: "flex", flexDirection: "column" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "var(--scout-border)",
          background: surface.card,
        }}
      >
        <Link
          href="/"
          style={{ ...bruddleHeadingStyle("h6"), color: color.forest, textDecoration: "none" }}
        >
          Kimchi
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link
            href="/live"
            style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone, textDecoration: "none" }}
          >
            Live webinars
          </Link>
          <Link
            href="/login"
            style={{
              fontFamily: fontSans,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--scout-cta-foreground)",
              background: "var(--scout-cta)",
              padding: "8px 14px",
              border: "var(--scout-border)",
              boxShadow: "var(--scout-shadow-bruddle)",
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>{children}</main>
    </div>
  );
}
