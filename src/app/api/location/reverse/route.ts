import { NextResponse } from "next/server";
import { reverseGeocodeCoordinates } from "@/lib/location-autocomplete";

/** Reverse geocode lat/lon to city label via Nominatim (free OSM). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get("lat") ?? "");
  const lon = Number.parseFloat(searchParams.get("lon") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  try {
    const suggestion = await reverseGeocodeCoordinates(lat, lon);
    if (!suggestion) {
      return NextResponse.json({ error: "Could not resolve location" }, { status: 404 });
    }
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.warn("[location/reverse]", err);
    return NextResponse.json({ error: "Reverse geocode failed" }, { status: 502 });
  }
}
