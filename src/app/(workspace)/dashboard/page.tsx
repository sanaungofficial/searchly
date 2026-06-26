import { WorkspaceDashboard } from "@/components/scout/workspace-dashboard";
import { RequireOnboardingComplete } from "@/components/auth/post-auth-redirect";

export default function DashboardPage() {
  return (
    <>
      <RequireOnboardingComplete />
      <WorkspaceDashboard />
    </>
  );
}
