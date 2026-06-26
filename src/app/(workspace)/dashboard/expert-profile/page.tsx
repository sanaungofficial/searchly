import { redirect } from "next/navigation";

export default function DashboardExpertProfilePage() {
  redirect("/dashboard/offerings?section=profile");
}
