import type { CachedJob } from "@/lib/cached-job";
import type { HirebaseJob } from "@/lib/hirebase";
import { parseProfileLocationString, relocationScopeFromPriorities, type ParsedProfileLocation } from "@/lib/profile-location";

export const LOCATION_RADIUS_OPTIONS = [
  { miles: 0, label: "Any distance" },
  { miles: 25, label: "25 miles" },
  { miles: 50, label: "50 miles" },
  { miles: 100, label: "100 miles" },
  { miles: 250, label: "250 miles" },
] as const;

const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

function locationQuery(parts: ParsedProfileLocation, fallback?: string | null): string {
  const fromParts = [parts.city, parts.region, parts.country].filter(Boolean).join(", ");
  return fromParts || fallback?.trim() || "";
}

function isRemoteJob(cached: CachedJob, raw?: HirebaseJob): boolean {
  if (cached.remote === true) return true;
  const locType = raw?.location_type?.toLowerCase() ?? cached.locationType?.toLowerCase() ?? "";
  if (locType.includes("remote")) return true;
  const loc = (cached.location ?? "").toLowerCase();
  return loc.includes("remote") || loc === "remote";
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
  return parseProfileLocationString(cached.location) ?? {};
}

export async function geocodePlace(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
    })}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Kimchi/1.0 (https://app.kimchi.so)" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data[0];
    const coord =
      hit?.lat && hit?.lon
        ? { lat: Number.parseFloat(hit.lat), lon: Number.parseFloat(hit.lon) }
        : null;
    if (coord && (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lon))) {
      geocodeCache.set(key, null);
      return null;
    }
    geocodeCache.set(key, coord);
    return coord;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

export function haversineMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type RecommendedJobSourceLike = {
  cached: CachedJob;
  raw: HirebaseJob;
};

function regionMatches(a: ParsedProfileLocation, b: ParsedProfileLocation): boolean {
  if (a.region?.trim() && b.region?.trim()) {
    return a.region.trim().toLowerCase() === b.region.trim().toLowerCase();
  }
  return false;
}

/** Keep remote roles; in-person/hybrid must fall within radius of anchor city when set. */
export async function filterSourcesByRadiusMiles<T extends RecommendedJobSourceLike>(
  sources: T[],
  input: {
    anchorLocation?: string | null;
    radiusMiles?: number;
    priorities?: string[];
  },
): Promise<T[]> {
  const radius = input.radiusMiles ?? 0;
  if (radius <= 0) return sources;

  const scope = relocationScopeFromPriorities(input.priorities ?? []);
  if (scope === "international") return sources;

  const home = parseProfileLocationString(input.anchorLocation);
  if (!home?.city?.trim()) return sources;

  const homeQuery = locationQuery(home);
  const homeCoord = await geocodePlace(homeQuery);
  if (!homeCoord) return sources;

  const kept: T[] = [];
  for (const entry of sources) {
    if (isRemoteJob(entry.cached, entry.raw)) {
      kept.push(entry);
      continue;
    }

    const jobParts = jobLocationParts(entry.cached, entry.raw);
    const jobQuery = locationQuery(jobParts, entry.cached.location);
    if (!jobQuery) {
      kept.push(entry);
      continue;
    }

    const jobCoord = await geocodePlace(jobQuery);
    if (!jobCoord) {
      if (regionMatches(home, jobParts)) kept.push(entry);
      continue;
    }

    if (haversineMiles(homeCoord, jobCoord) <= radius) kept.push(entry);
  }

  return kept;
}

export function locationRadiusLabel(miles: number): string {
  const match = LOCATION_RADIUS_OPTIONS.find((opt) => opt.miles === miles);
  return match?.label ?? `Within ${miles} miles`;
}
