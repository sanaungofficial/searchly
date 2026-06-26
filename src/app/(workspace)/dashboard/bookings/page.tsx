import { redirect } from "next/navigation";

export default function DashboardBookingsPage() {
  redirect("/expert/ops?section=bookings");
}
