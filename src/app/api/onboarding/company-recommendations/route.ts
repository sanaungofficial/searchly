import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import {
  buildRecommendationSignals,
  computeCompanyRecommendations,
  hasRecommendationSignals,
  type CompanyRecommendation,
} from "@/lib/company-recommendations";
import type { ReadbackPayload } from "@/lib/readback-display";

type RequestBody = {
  targetRoles?: unknown;
  prioritizedRoles?: unknown;
  watchlistSlugs?: unknown;
  readbackData?: unknown;
};

function asStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, max);
}

function asReadbackPayload(value: unknown): ReadbackPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.picture !== "string" || !Array.isArray(row.strengths) || !Array.isArray(row.targetRoles)) {
    return null;
  }
  const targetRoles = row.targetRoles
    .filter((r): r is { role: string; fit?: string } => typeof (r as Record<string, unknown>).role === "string")
    .map((r) => ({
      role: r.role,
      fit: typeof r.fit === "string" ? r.fit : "",
    }));
  return {
    picture: row.picture,
    strengths: row.strengths.filter((s): s is string => typeof s === "string"),
    targetRoles,
    honestNote: typeof row.honestNote === "string" ? row.honestNote : "",
  };
}

function stripRecommendation(rec: CompanyRecommendation) {
  return {
    catalogSlug: rec.catalogSlug,
    name: rec.name,
    website: rec.website,
    careersUrl: rec.careersUrl,
    type: rec.type,
  };
}

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser(req);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const targetRoles = asStringArray(body.targetRoles);
  const prioritizedRoles = asStringArray(body.prioritizedRoles, 5);
  const watchlistSlugs = asStringArray(body.watchlistSlugs, 10);
  const clientReadback = asReadbackPayload(body.readbackData);

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: dbUser.id },
      select: { targetRoles: true, prioritizedRoles: true, parsedData: true, readbackData: true },
    });

    const signals = buildRecommendationSignals({
      targetRoles: targetRoles.length ? targetRoles : profile?.targetRoles,
      prioritizedRoles: prioritizedRoles.length ? prioritizedRoles : profile?.prioritizedRoles,
      parsedData: profile?.parsedData,
      readbackData: clientReadback ?? profile?.readbackData,
      watchlistSlugs,
    });

    const recommendations = computeCompanyRecommendations(signals).map(stripRecommendation);
    return NextResponse.json({
      recommendations,
      personalized: hasRecommendationSignals(signals),
    });
  } catch (err) {
    console.error("[onboarding/company-recommendations POST]", err);
    return NextResponse.json({ error: "Couldn't load suggestions." }, { status: 500 });
  }
}
