import { redirect } from "next/navigation";

export default function DashboardBookingsPage() {
  redirect("/dashboard/ops?section=bookings");
}
