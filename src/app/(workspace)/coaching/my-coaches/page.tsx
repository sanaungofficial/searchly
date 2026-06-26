import { WorkspaceCoaching } from "@/components/scout/workspace-coaching";
import { BetaFeaturePage } from "@/lib/beta-feature-page";

export default function MyCoachesPage() {
  return (
    <BetaFeaturePage feature="coaching">
      <WorkspaceCoaching />
    </BetaFeaturePage>
  );
}
