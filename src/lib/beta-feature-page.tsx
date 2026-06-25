import { BetaComingSoon } from "@/components/scout/beta-coming-soon";
import { canAccessBetaFeature, type BetaFeatureId } from "@/lib/beta-features";
import { isAdmin } from "@/lib/auth";
import type { ReactNode } from "react";

/** Prod non-admins get coming soon for gated beta features; coaching is live for everyone. */
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
