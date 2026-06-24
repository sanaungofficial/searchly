import { WorkspaceNetwork } from "@/components/scout/workspace-network";
import { BetaFeaturePage } from "@/lib/beta-feature-page";

export default function NetworkPage() {
  return (
    <BetaFeaturePage feature="network">
      <WorkspaceNetwork />
    </BetaFeaturePage>
  );
}
