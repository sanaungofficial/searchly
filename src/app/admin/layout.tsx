import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  return (
    <div className="min-h-screen bg-[#F2EDE3]">
      <header className="border-b border-stone-200 bg-white/60 backdrop-blur-sm px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-stone-800 tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
            Kimchi
          </span>
          <span className="text-stone-300">/</span>
          <span className="text-sm text-stone-500 font-medium">Admin</span>
          <span className="text-stone-300">/</span>
          <AdminNav />
        </div>
        <span className="text-xs text-stone-400 font-mono">super admin</span>
      </header>
      <main className="max-w-6xl mx-auto px-8 py-10">{children}</main>
    </div>
  );
}
