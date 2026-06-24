import { WorkspaceLive } from "@/components/scout/workspace-live";
import { BetaFeaturePage } from "@/lib/beta-feature-page";

export default function LivePage() {
  return (
    <BetaFeaturePage feature="live">
      <WorkspaceLive />
    </BetaFeaturePage>
  );
}
