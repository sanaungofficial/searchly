import { useSubscription } from "@/hooks/useSubscription";
import { isCreditsExhausted, isCreditsLow, type CreditBalance } from "@/lib/credits";

export function useCredits() {
  const sub = useSubscription();
  const credits = sub.credits;
  const proUser = sub.isPro || sub.isAdmin;
  const showCredits = !sub.loading && !proUser && credits !== null;

  return {
    ...sub,
    credits,
    proUser,
    showCredits,
    exhausted: credits ? isCreditsExhausted(credits) : false,
    low: credits ? isCreditsLow(credits) : false,
  };
}

export function creditsSummary(credits: CreditBalance): string {
  if (credits.remaining <= 0) return "No credits left this month";
  return `${credits.remaining} credit${credits.remaining === 1 ? "" : "s"} left`;
}
