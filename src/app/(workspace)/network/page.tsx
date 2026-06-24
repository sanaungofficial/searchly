import { redirect } from "next/navigation";
import { WorkspaceNetwork } from "@/components/scout/workspace-network";
import { isAdmin } from "@/lib/auth";
import { canAccessBetaFeatures } from "@/lib/beta-features";

export default async function NetworkPage() {
  if (!canAccessBetaFeatures(await isAdmin())) {
    redirect("/dashboard");
  }
  return <WorkspaceNetwork />;
}
