import { redirect } from "next/navigation";
import { WorkspaceCoaching } from "@/components/scout/workspace-coaching";
import { isAdmin } from "@/lib/auth";
import { canAccessBetaFeatures } from "@/lib/beta-features";

export default async function CoachingPage() {
  if (!canAccessBetaFeatures(await isAdmin())) {
    redirect("/dashboard");
  }
  return <WorkspaceCoaching />;
}
