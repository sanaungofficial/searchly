import { redirect } from "next/navigation";

export default function DashboardClientsPage() {
  redirect("/dashboard/ops?section=clients");
}
