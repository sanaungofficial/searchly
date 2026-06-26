import { redirect } from "next/navigation";

export default function DashboardAvailabilityPage() {
  redirect("/expert/offerings?section=availability");
}
