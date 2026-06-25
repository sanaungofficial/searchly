import { WorkspaceLive } from "@/components/scout/workspace-live";
import { BetaFeaturePage } from "@/lib/beta-feature-page";
import { CoachLiveRedirect } from "@/components/scout/coach-live-redirect";

export default function LivePage() {
  return (
    <CoachLiveRedirect>
      <BetaFeaturePage feature="live">
        <WorkspaceLive />
      </BetaFeaturePage>
    </CoachLiveRedirect>
  );
}
