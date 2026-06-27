import type { CachedJob } from "@/lib/cached-job";
import type { HirebaseJob } from "@/lib/hirebase";
import type { HirebaseLocationFilter } from "@/lib/vector-matched-job";

export type ParsedProfileLocation = {
  city?: string;
  region?: string;
  country?: string;
};

export type RelocationScope = "local" | "domestic" | "international";

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const US_STATE_ABBR_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_NAMES).map(([abbr, name]) => [name.toLowerCase(), abbr]),
);

const US_COUNTRY_ALIASES = new Set([
  "us",
  "usa",
  "u.s.",
  "u.s.a.",
  "united states",
  "united states of america",
]);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function regionToAbbr(region?: string): string | undefined {
  if (!region?.trim()) return undefined;
  const trimmed = region.trim();
  if (trimmed.length === 2 && US_STATE_NAMES[trimmed.toUpperCase()]) return trimmed.toUpperCase();
  return US_STATE_ABBR_BY_NAME[trimmed.toLowerCase()];
}

/** Compact label for UI + targetMarket, e.g. "Richmond, VA". */
export function formatCompactProfileLocation(parsed: ParsedProfileLocation | null | undefined): string | null {
  if (!parsed) return null;
  const regionAbbr = regionToAbbr(parsed.region);
  if (parsed.city && regionAbbr) return `${parsed.city}, ${regionAbbr}`;
  if (parsed.city && parsed.region) return `${parsed.city}, ${parsed.region}`;
  if (parsed.region && parsed.country) {
    const countryNorm = normalizeToken(parsed.country);
    if (US_COUNTRY_ALIASES.has(countryNorm)) {
      return regionAbbr ? `${parsed.region}, ${regionAbbr}` : parsed.region;
    }
    return `${parsed.region}, ${parsed.country}`;
  }
  return parsed.city ?? parsed.region ?? parsed.country ?? null;
}

function expandRegion(token: string): string {
  const upper = token.trim().toUpperCase();
  return US_STATE_NAMES[upper] ?? token.trim();
}

/** Parse free-text profile location (e.g. "Baltimore, MD" or "London, UK"). */
export function parseProfileLocationString(raw: string | null | undefined): ParsedProfileLocation | null {
  const text = raw?.trim();
  if (!text) return null;

  const parts = text
    .split(/[,|/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  const last = parts[parts.length - 1]!;
  const lastNorm = normalizeToken(last);

  if (US_COUNTRY_ALIASES.has(lastNorm) && parts.length >= 2) {
    const regionToken = parts[parts.length - 2]!;
    return {
      city: parts.length >= 3 ? parts[0] : undefined,
      region: expandRegion(regionToken),
      country: "United States",
    };
  }

  if (parts.length === 1) {
    const only = parts[0]!;
    if (only.length === 2 && US_STATE_NAMES[only.toUpperCase()]) {
      return { region: US_STATE_NAMES[only.toUpperCase()], country: "United States" };
    }
    return { city: only };
  }

  if (parts.length === 2) {
    const secondNorm = normalizeToken(parts[1]!);
    if (secondNorm.length === 2 && US_STATE_NAMES[parts[1]!.toUpperCase()]) {
      return {
        city: parts[0],
        region: US_STATE_NAMES[parts[1]!.toUpperCase()],
        country: "United States",
      };
    }
    return { city: parts[0], country: parts[1] };
  }

  return {
    city: parts[0],
    region: expandRegion(parts[1]!),
    country: parts[2],
  };
}

export function relocationScopeFromPriorities(priorities: string[]): RelocationScope {
  const lower = priorities.map((p) => p.toLowerCase());
  if (lower.some((p) => p.includes("relocating internationally") || p.includes("relocation abroad"))) {
    return "international";
  }
  if (lower.some((p) => p.includes("relocating within") || p.includes("domestic relocation"))) {
    return "domestic";
  }
  return "local";
}

/** Prefer explicit target market, then resume-parsed location. */
export function resolveProfileLocation(input: {
  parsedLocation?: string | null;
  targetMarket?: string | null;
}): string | null {
  const target = input.targetMarket?.trim();
  if (target) return target;
  const parsed = input.parsedLocation?.trim();
  return parsed || null;
}

export function profileLocationToHirebaseFilters(input: {
  profileLocation?: string | null;
  priorities?: string[];
}): HirebaseLocationFilter[] {
  const home = parseProfileLocationString(input.profileLocation);
  if (!home) return [];

  const scope = relocationScopeFromPriorities(input.priorities ?? []);
  if (scope === "international") return [];

  const filters: HirebaseLocationFilter[] = [];
  if (home.country?.trim()) {
    filters.push({ country: home.country.trim() });
    return filters;
  }
  if (home.region?.trim()) {
    filters.push({ region: home.region.trim(), country: "United States" });
  }
  return filters;
}

function jobLocationParts(cached: CachedJob, raw?: HirebaseJob): ParsedProfileLocation {
  const fromRaw = raw?.locations?.[0];
  if (fromRaw) {
    return {
      city: fromRaw.city?.trim() || undefined,
      region: fromRaw.region?.trim() || undefined,
      country: fromRaw.country?.trim() || undefined,
    };
  }

  const parsed = parseProfileLocationString(cached.location);
  return parsed ?? {};
}

function isRemoteJob(cached: CachedJob, raw?: HirebaseJob): boolean {
  if (cached.remote === true) return true;
  const locType = (raw?.location_type ?? cached.locationType ?? "").toLowerCase();
  if (locType.includes("remote")) return true;
  const loc = (cached.location ?? "").toLowerCase();
  return loc.includes("remote") || loc === "remote";
}

const OVERSEAS_LOCATION_MARKERS = [
  "switzerland",
  "schweiz",
  "zürich",
  "zurich",
  "geneva",
  "bern",
  "basel",
  "united kingdom",
  " england",
  " scotland",
  " wales",
  " uk",
  "germany",
  "france",
  "paris",
  "berlin",
  "canada",
  "toronto",
  "vancouver",
  "montreal",
  "australia",
  "sydney",
  "melbourne",
  "singapore",
  "india",
  "bangalore",
  "mumbai",
  "netherlands",
  "amsterdam",
  "ireland",
  "dublin",
  "spain",
  "madrid",
  "barcelona",
  "italy",
  "milan",
  "rome",
  "japan",
  "tokyo",
  "mexico",
  "brazil",
];

function mentionsOverseasLocation(jobHay: string): boolean {
  return OVERSEAS_LOCATION_MARKERS.some((marker) => jobHay.includes(marker));
}

function remoteJobAllowedForScope(
  cached: CachedJob,
  raw: HirebaseJob | undefined,
  home: ParsedProfileLocation,
  scope: RelocationScope,
): boolean {
  if (scope !== "local") return true;
  if (!home.country || !US_COUNTRY_ALIASES.has(normalizeToken(home.country))) return true;

  const jobParts = jobLocationParts(cached, raw);
  const jobHay = locationHaystack(jobParts, cached);
  if (!jobHay.trim()) return true;
  if (matchesCountry(jobHay, home.country)) return true;
  return !mentionsOverseasLocation(jobHay);
}

function locationHaystack(parts: ParsedProfileLocation, cached: CachedJob): string {
  return [parts.city, parts.region, parts.country, cached.location]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesCountry(jobHay: string, country?: string): boolean {
  if (!country?.trim()) return false;
  const norm = normalizeToken(country);
  if (US_COUNTRY_ALIASES.has(norm)) {
    return (
      jobHay.includes("united states") ||
      jobHay.includes(" usa") ||
      jobHay.includes(", us") ||
      jobHay.endsWith(" us") ||
      /\b(us|usa|u\.s\.)\b/.test(jobHay)
    );
  }
  return jobHay.includes(norm);
}

function matchesRegion(jobHay: string, region?: string): boolean {
  if (!region?.trim()) return false;
  const norm = normalizeToken(region);
  if (jobHay.includes(norm)) return true;
  const abbr = Object.entries(US_STATE_NAMES).find(([, name]) => normalizeToken(name) === norm)?.[0];
  if (abbr && new RegExp(`\\b${abbr.toLowerCase()}\\b`).test(jobHay)) return true;
  return false;
}

function matchesCity(jobHay: string, city?: string): boolean {
  if (!city?.trim()) return false;
  return jobHay.includes(normalizeToken(city));
}

/** Keep remote roles; otherwise enforce profile location + relocation preferences. */
export function jobMatchesLocationPreference(
  cached: CachedJob,
  raw: HirebaseJob | undefined,
  input: {
    profileLocation?: string | null;
    priorities?: string[];
  },
): boolean {
  const home = parseProfileLocationString(input.profileLocation);
  if (!home) return true;

  const scope = relocationScopeFromPriorities(input.priorities ?? []);

  if (isRemoteJob(cached, raw)) {
    return remoteJobAllowedForScope(cached, raw, home, scope);
  }

  if (scope === "international") return true;

  const jobParts = jobLocationParts(cached, raw);
  const jobHay = locationHaystack(jobParts, cached);

  if (scope === "domestic") {
    if (home.country) return matchesCountry(jobHay, home.country);
    if (home.region) return matchesRegion(jobHay, home.region) || matchesCountry(jobHay, "United States");
    return true;
  }

  // Local — same metro/state/country; block obvious international postings.
  if (home.city && matchesCity(jobHay, home.city)) return true;
  if (home.region && matchesRegion(jobHay, home.region)) return true;
  if (home.country && matchesCountry(jobHay, home.country)) {
    // Same country but different region — reject unless domestic relocation is set (handled above).
    if (home.region && !matchesRegion(jobHay, home.region)) return false;
    return true;
  }

  return false;
}

export type RecommendedJobSourceLike = {
  cached: CachedJob;
  raw: HirebaseJob;
};

export function filterSourcesByLocationPreference<T extends RecommendedJobSourceLike>(
  sources: T[],
  input: {
    profileLocation?: string | null;
    priorities?: string[];
  },
): T[] {
  if (!parseProfileLocationString(input.profileLocation)) return sources;
  return sources.filter((s) => jobMatchesLocationPreference(s.cached, s.raw, input));
}

export function filterJobsByLocationPreference<T extends CachedJob>(
  jobs: T[],
  input: {
    profileLocation?: string | null;
    priorities?: string[];
  },
): T[] {
  if (!parseProfileLocationString(input.profileLocation)) return jobs;
  return jobs.filter((j) => jobMatchesLocationPreference(j, undefined, input));
}
