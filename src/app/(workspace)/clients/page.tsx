import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CoachClientsPage } from "./coach-clients-page";

export default async function ClientsPage() {
  const admin = await requireAdmin();
  if (admin) redirect("/dashboard/ops?section=clients");
  return <CoachClientsPage />;
}
