/** Tracks Sumble credit balance from API responses and blocks paid calls when low. */

const LOW_CREDIT_THRESHOLD = 5;

let lastCreditsRemaining: number | null = null;
let lastUpdatedAt = 0;

export const SUMBLE_ESTIMATED_COSTS = {
  marketSample: 25,
  companyLite: 8,
  companyFull: 20,
  dashboardSignals: 12,
  intelligenceBrief: 50,
  emailReveal: 10,
  phoneReveal: 80,
  jobContacts: 8,
  marketSignals: 8,
  marketProjects: 15,
  growingEmployers: 15,
  orgListSync: 5,
  titleLookup: 1,
  techLookup: 1,
  orgByTechStack: 5,
  orgTechEnrich: 5,
} as const;

export function recordSumbleCreditsRemaining(remaining: number | null | undefined): void {
  if (remaining == null || !Number.isFinite(remaining)) return;
  lastCreditsRemaining = remaining;
  lastUpdatedAt = Date.now();
}

export function getSumbleCreditsRemaining(): number | null {
  return lastCreditsRemaining;
}

export function getSumbleCreditsUpdatedAt(): number {
  return lastUpdatedAt;
}

export class SumbleInsufficientCreditsError extends Error {
  readonly creditsRemaining: number | null;
  readonly estimatedCost: number;

  constructor(estimatedCost: number, creditsRemaining: number | null) {
    const balance =
      creditsRemaining != null
        ? `${creditsRemaining.toLocaleString()} credits remaining`
        : "credit balance unknown";
    super(
      `Not enough Sumble credits for this request (needs ~${estimatedCost}, ${balance}). Load data manually when you have credits.`
    );
    this.name = "SumbleInsufficientCreditsError";
    this.estimatedCost = estimatedCost;
    this.creditsRemaining = creditsRemaining;
  }
}

/** Refuse paid Sumble calls when we know the balance is below the estimate. */
export function assertSumbleCreditsAvailable(estimatedCost: number): void {
  if (lastCreditsRemaining == null) return;
  if (lastCreditsRemaining < estimatedCost) {
    throw new SumbleInsufficientCreditsError(estimatedCost, lastCreditsRemaining);
  }
}

export function isSumbleCreditsLow(): boolean {
  return lastCreditsRemaining != null && lastCreditsRemaining < LOW_CREDIT_THRESHOLD;
}
