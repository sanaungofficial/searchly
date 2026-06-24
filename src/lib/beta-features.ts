/** Live, Coaching, Network — hidden in production except for admins. */

export function isProductionEnv(): boolean {
  return (
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function canAccessBetaFeatures(isAdmin: boolean): boolean {
  return !isProductionEnv() || isAdmin;
}
