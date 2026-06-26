import { redirect } from "next/navigation";

export default function DashboardExpertProfilePage() {
  redirect("/expert/offerings?section=profile");
}
