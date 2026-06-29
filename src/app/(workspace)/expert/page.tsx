import { redirect } from "next/navigation";
import { EXPERT_DASHBOARD_PATH } from "@/lib/staff-portal";

export default function ExpertHomePage() {
  redirect(EXPERT_DASHBOARD_PATH);
}
