import { NextRequest, NextResponse } from "next/server";
import { resolveCoachOrgLookups } from "@/lib/coach-org-lookup";

export async function GET(req: NextRequest) {
  const namesParam = req.nextUrl.searchParams.get("names")?.trim() ?? "";
  const names = namesParam
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 24);

  if (!names.length) return NextResponse.json({});

  const lookups = await resolveCoachOrgLookups(names);
  return NextResponse.json(lookups);
}
