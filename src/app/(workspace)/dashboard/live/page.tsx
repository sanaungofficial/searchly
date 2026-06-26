import { redirect } from "next/navigation";

export default function DashboardLivePage() {
  redirect("/dashboard/ops?section=live");
}
