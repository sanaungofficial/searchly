import { BetaComingSoon } from "@/components/scout/beta-coming-soon";
import { canAccessBetaFeature, type BetaFeatureId } from "@/lib/beta-features";
import { isAdmin } from "@/lib/auth";
import type { ReactNode } from "react";

/** Non-admins see coming soon for gated beta features; coaching is public on all envs. */
export async function BetaFeaturePage({
  feature,
  children,
}: {
  feature: BetaFeatureId;
  children: ReactNode;
}) {
  if (!canAccessBetaFeature(feature, await isAdmin())) {
    return <BetaComingSoon feature={feature} />;
  }
  return children;
}
