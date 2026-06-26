import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminPageShell } from "@/components/scout/admin-page-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  return <AdminPageShell>{children}</AdminPageShell>;
}
