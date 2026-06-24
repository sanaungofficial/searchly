import { BetaComingSoon } from "@/components/scout/beta-coming-soon";
import { canAccessBetaFeatures, type BetaFeatureId } from "@/lib/beta-features";
import { isAdmin } from "@/lib/auth";
import type { ReactNode } from "react";

/** Prod non-admins get coming soon; dev and prod admins get the real page. */
export async function BetaFeaturePage({
  feature,
  children,
}: {
  feature: BetaFeatureId;
  children: ReactNode;
}) {
  if (!canAccessBetaFeatures(await isAdmin())) {
    return <BetaComingSoon feature={feature} />;
  }
  return children;
}
