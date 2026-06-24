const BIG_BILLER_ORIGIN = "https://bigbiller.topechelon.com";

/** Public Big Biller URL for a network job posting. */
export function topEchelonNetworkJobUrl(externalId: string | number): string {
  return `${BIG_BILLER_ORIGIN}/network/jobs/${externalId}`;
}
