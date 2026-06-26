import { useSubscription } from "@/hooks/useSubscription";
import {
  isCreditsExhausted,
  isCreditsLow,
  isUnlimitedBalance,
  UNLIMITED_AI_FOR_ALL,
  type CreditBalance,
} from "@/lib/credits";

/** Paid Pro subscribers — hide credit UI. Free + admin always see balances. */
export function shouldShowCredits(sub: {
  loading: boolean;
  credits: CreditBalance | null;
  isPro: boolean;
  isAdmin: boolean;
}): boolean {
  if (UNLIMITED_AI_FOR_ALL) return false;
  if (sub.loading || !sub.credits) return false;
  if (sub.isAdmin) return true;
  return !sub.isPro;
}

/** Unlimited AI — no 402, no upgrade CTAs. */
export function hasUnlimitedAi(sub: { isPro: boolean; isAdmin: boolean }): boolean {
  if (UNLIMITED_AI_FOR_ALL) return true;
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

function isUnlimitedCredits(credits: CreditBalance, unlimitedAi = false): boolean {
  return unlimitedAi || isUnlimitedBalance(credits);
}

export function creditsSummary(credits: CreditBalance, unlimitedAi = false): string {
  if (isUnlimitedCredits(credits, unlimitedAi)) return "Unlimited AI";
  if (credits.remaining <= 0) return "No credits left this month";
  return `${credits.remaining} credit${credits.remaining === 1 ? "" : "s"} left`;
}

export function creditsUsageCount(credits: CreditBalance, unlimitedAi = false): string {
  if (isUnlimitedCredits(credits, unlimitedAi)) {
    return `${credits.used} / unlimited`;
  }
  return `${credits.used}/${credits.limit} used`;
}

export function creditsUsageSubtitle(_credits: CreditBalance, _unlimitedAi = false): string {
  return "1 credit per AI action · Resets monthly";
}
