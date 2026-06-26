import { redirect } from "next/navigation";

export default function DashboardClientsPage() {
  redirect("/expert/ops?section=clients");
}
