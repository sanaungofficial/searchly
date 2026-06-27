import { NextResponse } from "next/server";
import { searchLocationSuggestions } from "@/lib/location-autocomplete";

/** City/region autocomplete via Photon (free OSM geocoder). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchLocationSuggestions(q, 6);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.warn("[location/suggest]", err);
    return NextResponse.json({ suggestions: [] });
  }
}
