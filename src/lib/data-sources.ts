/** Marketing copy + ATS metadata for the data-sources popover. */

export type AtsPlatform = {
  name: string;
  /** Clearbit / favicon domain */
  domain: string;
  /** Fallback wordmark color when logo fails */
  brandColor?: string;
};

/** Featured in the logo row (demo-friendly). */
export const FEATURED_ATS_PLATFORMS: AtsPlatform[] = [
  { name: "Greenhouse", domain: "greenhouse.io", brandColor: "#24A148" },
  { name: "iCIMS", domain: "icims.com", brandColor: "#1A1A1A" },
  { name: "Lever", domain: "lever.co", brandColor: "#1B365D" },
  { name: "Workday", domain: "workday.com", brandColor: "#005CB9" },
];

export const EXTENDED_ATS_NAMES = [
  "Ashby",
  "BambooHR",
  "SmartRecruiters",
  "Taleo",
  "Dayforce",
  "JazzHR",
  "Jobvite",
  "Recruitee",
  "TeamTailor",
  "Workable",
  "Pinpoint",
  "Rippling",
  "Personio",
  "Paylocity",
  "Paycom",
] as const;

export const AGGREGATOR_SOURCES = [
  { name: "LinkedIn", domain: "linkedin.com" },
  { name: "Indeed", domain: "indeed.com" },
  { name: "Glassdoor", domain: "glassdoor.com" },
  { name: "Monster", domain: "monster.com" },
] as const;

export const DATA_SOURCE_STATS = {
  careerPagesScanned: "300,000+",
  atsPlatforms: "80+",
  companyPagesIndexed: "160,000+",
  scanFrequency: "5–10× per day",
  newJobLatency: "within 2 hours",
  purgeLatency: "2–3 hours (up to 24h)",
} as const;

export const DATA_SOURCE_HIGHLIGHTS = [
  {
    title: "Direct to the source",
    body: `We index ${DATA_SOURCE_STATS.companyPagesIndexed} company career pages and ATS platforms — every listing verified active at the employer level.`,
  },
  {
    title: "Always fresh",
    body: `Most sources scanned ${DATA_SOURCE_STATS.scanFrequency}. New jobs appear ${DATA_SOURCE_STATS.newJobLatency} of posting. Removed listings purged in ${DATA_SOURCE_STATS.purgeLatency}.`,
  },
  {
    title: "Broad ATS coverage",
    body: `Greenhouse, Lever, Workday, iCIMS, ${EXTENDED_ATS_NAMES.slice(0, 5).join(", ")}, and 10+ more. Non-ATS companies? We index their career pages directly.`,
  },
  {
    title: "Agency filter",
    body: "Optional filter to include or exclude staffing-agency listings — you control what shows up in your feed.",
  },
] as const;
