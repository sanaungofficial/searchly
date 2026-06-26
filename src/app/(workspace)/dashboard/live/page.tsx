import { redirect } from "next/navigation";

export default function DashboardLivePage() {
  redirect("/expert/inbox?section=live");
}
