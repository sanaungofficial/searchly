import { redirect } from "next/navigation";
import { WorkspaceLive } from "@/components/scout/workspace-live";
import { isAdmin } from "@/lib/auth";
import { canAccessBetaFeatures } from "@/lib/beta-features";

export default async function LivePage() {
  if (!canAccessBetaFeatures(await isAdmin())) {
    redirect("/dashboard");
  }
  return <WorkspaceLive />;
}
