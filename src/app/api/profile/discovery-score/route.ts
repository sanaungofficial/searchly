import { NextResponse } from "next/server";
import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { getDiscoveryScoreResponse, refreshDiscoveryScore } from "@/lib/discovery-score/refresh";

export async function GET(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;

  const response = await getDiscoveryScoreResponse(resolved.dbUser.id);
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;

  const response = await refreshDiscoveryScore(resolved.dbUser.id);
  return NextResponse.json(response);
}
