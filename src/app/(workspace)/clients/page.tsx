import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function ClientsRedirectPage() {
  const admin = await requireAdmin();
  if (admin) redirect("/admin/clients");
  redirect("/dashboard");
}
