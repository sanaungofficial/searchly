/** Live sessions, Coaching, Network — sidebar and page access vary by feature. */

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

/** Page-level access for Live / Coaching / Network routes. */
export function canAccessBetaFeature(feature: BetaFeatureId, _isAdmin: boolean): boolean {
  if (feature === "live") return true;
  if (feature === "network") return _isAdmin;
  if (!isProductionEnv()) return _isAdmin;
  if (feature === "coaching") return true;
  return _isAdmin;
}

/** Community nav (Live, Coaching, Network) — admins only in the sidebar. */
export function shouldShowCommunityNav(isAdmin: boolean): boolean {
  return isAdmin;
}

/** @deprecated Use shouldShowCommunityNav */
export function shouldShowBetaNav(isAdmin: boolean): boolean {
  return shouldShowCommunityNav(isAdmin);
}
