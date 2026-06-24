import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--scout-page)" }}>
      <header
        style={{
          borderBottom: "1px solid rgba(17,17,17,0.14)",
          background: "var(--scout-surface)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 8, height: 8, background: "#1A3A2F", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, color: "#1A3A2F", letterSpacing: "-0.02em" }}>
            Admin
          </span>
          <AdminNav />
        </div>
        <span style={{ fontSize: 11, color: "var(--scout-muted)", fontFamily: "var(--font-mono-ui)", letterSpacing: "0.06em" }}>
          super admin
        </span>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 32px 48px", width: "100%", boxSizing: "border-box" }}>
        {children}
      </main>
    </div>
  );
}
