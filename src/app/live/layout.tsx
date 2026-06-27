import Link from "next/link";
import { color, fontSans, surface } from "@/lib/typography";

export default function PublicLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: surface.page, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(26,58,47,0.12)",
          background: "#fff",
        }}
      >
        <Link href="/" style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 700, color: color.forest, textDecoration: "none" }}>
          Kimchi
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/live" style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone, textDecoration: "none" }}>
            Live webinars
          </Link>
          <Link
            href="/login"
            style={{
              fontFamily: fontSans,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: color.forest,
              padding: "8px 14px",
              borderRadius: 6,
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
