import { redirect } from "next/navigation";

export default function DashboardAvailabilityPage() {
  redirect("/dashboard/offerings?section=availability");
}
