import { BetaComingSoon } from "@/components/scout/beta-coming-soon";
import { canAccessBetaFeatures, type BetaFeatureId } from "@/lib/beta-features";
import { isAdmin } from "@/lib/auth";
import type { ReactNode } from "react";

/** Admins get the real page; everyone else sees coming soon. */
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
