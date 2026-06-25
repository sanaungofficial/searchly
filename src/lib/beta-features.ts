/** Live sessions, Coaching, Network — full access on dev; prod admins only; prod users see coming soon. */

export type BetaFeatureId = "live" | "coaching" | "network";

export const BETA_FEATURES: Record<
  BetaFeatureId,
  { navLabel: string; label: string; title: string; description: string }
> = {
  live: {
    navLabel: "Live sessions",
    label: "Live sessions",
    title: "Trainings & webinars, coming soon.",
    description:
      "Live workshops and webinars with Second Ladder coaches and partners — interview prep, negotiation, and search strategy.",
  },
  coaching: {
    navLabel: "Coaching",
    label: "1:1 coaching",
    title: "Personal coaching, coming soon.",
    description:
      "Book time with vetted career coaches for resume reviews, mock interviews, and a tailored search plan.",
  },
  network: {
    navLabel: "Network",
    label: "Your network",
    title: "Warm introductions, coming soon.",
    description:
      "See who in the Kimchi community can refer you in — and opt in when you are ready to return the favor.",
  },
};

export function isProductionEnv(): boolean {
  if (
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return true;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.includes("app.kimchi.so");
}

/** Dev/preview: everyone. Production: coaching is live; live/network admins only. */
export function canAccessBetaFeature(feature: BetaFeatureId, isAdmin: boolean): boolean {
  if (!isProductionEnv()) return true;
  if (feature === "coaching") return true;
  return isAdmin;
}

/** Dev/preview: everyone. Production: admins only (legacy — prefer per-feature). */
export function canAccessBetaFeatures(isAdmin: boolean): boolean {
  return !isProductionEnv() || isAdmin;
}

/** Whether the Community nav group should appear in the sidebar. */
export function shouldShowCommunityNav(isAdmin: boolean): boolean {
  if (!isProductionEnv()) return true;
  return (
    canAccessBetaFeature("live", isAdmin) ||
    canAccessBetaFeature("coaching", isAdmin) ||
    canAccessBetaFeature("network", isAdmin)
  );
}

/** Whether Live / Coaching / Network appear in the sidebar (all items — filter per feature in nav). */
export function shouldShowBetaNav(isAdmin: boolean): boolean {
  return shouldShowCommunityNav(isAdmin);
}
