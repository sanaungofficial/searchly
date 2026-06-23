/** Free-plan AI credits per calendar month (stored in MonthlyUsage.count). */
export const FREE_MONTHLY_CREDITS = 15;

export type CreditBalance = {
  used: number;
  limit: number;
  remaining: number;
};

export function toCreditBalance(used: number, limit: number): CreditBalance {
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/** Shown on pricing / settings — what consumes a credit. */
export const CREDIT_ACTIONS = [
  "Resume match analysis",
  "Resume tailoring",
  "Cover letter generation",
  "Scout chat messages",
  "Profile readback refresh",
] as const;

export const CREDITS_EXHAUSTED_ERROR = "Out of credits for this month";

export function isCreditsLow(balance: CreditBalance): boolean {
  return balance.remaining > 0 && balance.remaining <= Math.ceil(balance.limit * 0.2);
}

export function isCreditsExhausted(balance: CreditBalance): boolean {
  return balance.remaining <= 0;
}

export const CREDITS_CHANGED_EVENT = "kimchi:credits-changed";

/** Call after any AI action completes (success or 402) so meters stay in sync. */
export function notifyCreditsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
  }
}
