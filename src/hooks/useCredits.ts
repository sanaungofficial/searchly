import { useSubscription } from "@/hooks/useSubscription";
import { isCreditsExhausted, isCreditsLow, type CreditBalance } from "@/lib/credits";

/** Paid Pro subscribers — hide credit UI. Free + admin always see balances. */
export function shouldShowCredits(sub: {
  loading: boolean;
  credits: CreditBalance | null;
  isPro: boolean;
  isAdmin: boolean;
}): boolean {
  if (sub.loading || !sub.credits) return false;
  if (sub.isAdmin) return true;
  return !sub.isPro;
}

/** Unlimited AI — no 402, no upgrade CTAs. Admin and paid Pro. */
export function hasUnlimitedAi(sub: { isPro: boolean; isAdmin: boolean }): boolean {
  return sub.isPro || sub.isAdmin;
}

export function useCredits() {
  const sub = useSubscription();
  const credits = sub.credits;
  const showCredits = shouldShowCredits(sub);
  const unlimitedAi = hasUnlimitedAi(sub);

  return {
    ...sub,
    credits,
    showCredits,
    unlimitedAi,
    /** @deprecated use unlimitedAi */
    proUser: unlimitedAi,
    exhausted: credits && !unlimitedAi ? isCreditsExhausted(credits) : false,
    low: credits && !unlimitedAi ? isCreditsLow(credits) : false,
  };
}

export function creditsSummary(credits: CreditBalance): string {
  if (credits.remaining <= 0) return "No credits left this month";
  return `${credits.remaining} credit${credits.remaining === 1 ? "" : "s"} left`;
}
