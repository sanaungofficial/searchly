import {
  formatCompactProfileLocation,
  parseProfileLocationString,
  type ParsedProfileLocation,
} from "@/lib/profile-location";

export type LocationSuggestion = {
  id: string;
  label: string;
  value: string;
  subtitle?: string;
};

type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  type?: string;
  extent?: number[];
};

type PhotonFeature = {
  properties?: PhotonProperties;
};

const PHOTON_BASE = "https://photon.komoot.io/api/";
const PHOTON_REVERSE = "https://photon.komoot.io/reverse";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const KIMCHI_USER_AGENT = "Kimchi/1.0 (https://app.kimchi.so; contact@kimchi.so)";

const PLACE_TYPES = new Set(["city", "town", "village", "hamlet", "suburb", "locality", "municipality"]);

function photonPropertiesToLocation(props: PhotonProperties): ParsedProfileLocation {
  const city = props.city?.trim() || props.name?.trim() || undefined;
  const region = props.state?.trim() || undefined;
  const country =
    props.country?.trim() ||
    (props.countrycode?.trim()?.toUpperCase() === "US" ? "United States" : props.countrycode?.trim());
  return { city, region, country };
}

function featureToSuggestion(feature: PhotonFeature, index: number): LocationSuggestion | null {
  const props = feature.properties;
  if (!props) return null;

  const type = props.type?.toLowerCase() ?? "";
  if (type && !PLACE_TYPES.has(type) && type !== "house" && type !== "street") {
    if (!props.city && !props.state) return null;
  }

  const parsed = photonPropertiesToLocation(props);
  const value = formatCompactProfileLocation(parsed);
  if (!value) return null;

  const subtitleParts = [parsed.city, parsed.region, parsed.country]
    .filter(Boolean)
    .filter((part, i, arr) => arr.indexOf(part) === i);
  const subtitle =
    subtitleParts.length > 1 ? subtitleParts.join(", ") : parsed.country && parsed.country !== value ? parsed.country : undefined;

  const id = `${props.osm_type ?? "place"}-${props.osm_id ?? index}-${value}`;
  return { id, label: value, value, subtitle };
}

export async function searchLocationSuggestions(query: string, limit = 6): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(limit, 8)),
    lang: "en",
  });

  const res = await fetch(`${PHOTON_BASE}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: LocationSuggestion[] = [];

  for (const [index, feature] of (data.features ?? []).entries()) {
    const suggestion = featureToSuggestion(feature, index);
    if (!suggestion) continue;
    const key = suggestion.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
  }

  return out;
}

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  municipality?: string;
  city_district?: string;
  county?: string;
  state?: string;
  country?: string;
};

function nominatimAddressToLocation(addr: NominatimAddress): ParsedProfileLocation | null {
  const city =
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.hamlet?.trim() ||
    addr.suburb?.trim() ||
    addr.municipality?.trim() ||
    addr.city_district?.trim() ||
    undefined;

  const region = addr.state?.trim() || undefined;
  const country = addr.country?.trim() || undefined;

  if (city) return { city, region, country };

  if (addr.county?.trim() && region) {
    const countyLabel = addr.county.trim().replace(/\s+county$/i, "").trim();
    return parseProfileLocationString(`${countyLabel}, ${region}, ${country ?? "United States"}`);
  }

  if (region) return { region, country };
  return null;
}

function suggestionFromPhotonReverse(data: { features?: PhotonFeature[] }): LocationSuggestion | null {
  for (const [index, feature] of (data.features ?? []).entries()) {
    const suggestion = featureToSuggestion(feature, index);
    if (suggestion) {
      return { ...suggestion, subtitle: "Current location" };
    }
  }
  return null;
}

async function reverseGeocodeWithPhoton(lat: number, lon: number): Promise<LocationSuggestion | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    lang: "en",
  });

  const res = await fetch(`${PHOTON_REVERSE}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { features?: PhotonFeature[] };
  return suggestionFromPhotonReverse(data);
}

async function reverseGeocodeWithNominatim(lat: number, lon: number): Promise<LocationSuggestion | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    addressdetails: "1",
    zoom: "10",
  });

  const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
    headers: { "User-Agent": KIMCHI_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { address?: NominatimAddress };
  if (!data.address) return null;

  const parsed = nominatimAddressToLocation(data.address);
  const value = formatCompactProfileLocation(parsed);
  if (!value) return null;

  return {
    id: `reverse-nom-${lat.toFixed(4)}-${lon.toFixed(4)}`,
    label: value,
    value,
    subtitle: "Current location",
  };
}

/** Reverse geocode coordinates — Photon first, Nominatim fallback. */
export async function reverseGeocodeCoordinates(
  lat: number,
  lon: number,
): Promise<LocationSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const photon = await reverseGeocodeWithPhoton(lat, lon);
    if (photon) return photon;
  } catch {
    /* try nominatim */
  }

  try {
    return await reverseGeocodeWithNominatim(lat, lon);
  } catch {
    return null;
  }
}

/** Client-side Photon reverse when the API route is unavailable. */
export async function reverseGeocodeCoordinatesClient(
  lat: number,
  lon: number,
): Promise<LocationSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), lang: "en" });
    const res = await fetch(`${PHOTON_REVERSE}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return suggestionFromPhotonReverse(data);
  } catch {
    return null;
  }
}
