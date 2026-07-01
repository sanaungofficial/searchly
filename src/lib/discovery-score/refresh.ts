import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { isApifyConfigured } from "@/lib/apify-linkedin";
import { isSumbleConfigured } from "@/lib/sumble/client";
import { computeDiscoveryScoreFromCohort, enrichBenchmarksWithApify } from "./compute";
import { readDiscoveryScoreCache, writeDiscoveryScoreCache } from "./persist";
import { fetchBenchmarkPeopleFromSumble } from "./sumble-benchmark";
import type { DiscoveryProfileContext, DiscoveryScoreApiResponse, DiscoveryScoreCachePayload } from "./types";
import type { Profile, User } from "@prisma/client";

export function discoveryScoreFingerprint(ctx: DiscoveryProfileContext): string {
  const parts = [
    ...ctx.targetRoles,
    ...ctx.prioritizedRoles,
    ...(ctx.parsedData?.skills ?? []),
    ...(ctx.parsedData?.tools ?? []),
    ctx.headline ?? "",
    ctx.location ?? "",
  ];
  return createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 16);
}

export function buildDiscoveryProfileContext(profile: Profile, user: User): DiscoveryProfileContext {
  const parsed = normalizeParsedResumeData(profile.parsedData ?? null);
  return {
    userId: user.id,
    name: user.name ?? "You",
    headline: profile.headline,
    summary: profile.summary,
    targetRoles: profile.targetRoles ?? [],
    prioritizedRoles: profile.prioritizedRoles ?? [],
    prioritizedCategories: profile.prioritizedCategories ?? [],
    location: parsed?.location ?? profile.targetMarket ?? null,
    linkedinUrl: profile.linkedinUrl,
    parsedData: parsed
      ? {
          skills: parsed.skills,
          tools: parsed.tools,
          workExperience: parsed.workExperience,
          education: parsed.education,
          summary: parsed.summary,
        }
      : null,
  };
}

function configuredFlags() {
  return {
    sumble: isSumbleConfigured(),
    apify: isApifyConfigured(),
  };
}

export async function getDiscoveryScoreResponse(
  userId: string,
  options?: { force?: boolean },
): Promise<DiscoveryScoreApiResponse> {
  const configured = configuredFlags();
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile || !user) {
    return { cached: false, configured, result: null, error: "Profile not found" };
  }

  const ctx = buildDiscoveryProfileContext(profile, user);
  const fingerprint = discoveryScoreFingerprint(ctx);
  const cached = readDiscoveryScoreCache(profile.parsedData);

  if (cached && cached.fingerprint === fingerprint) {
    return { cached: true, configured, result: cached };
  }

  if (options?.force) {
    return refreshDiscoveryScore(userId);
  }

  return { cached: false, configured, result: null };
}

export async function refreshDiscoveryScore(userId: string): Promise<DiscoveryScoreApiResponse> {
  const configured = configuredFlags();
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile || !user) {
    return { cached: false, configured, result: null, error: "Profile not found" };
  }

  const ctx = buildDiscoveryProfileContext(profile, user);
  const fingerprint = discoveryScoreFingerprint(ctx);

  if (!configured.sumble) {
    return {
      cached: false,
      configured,
      result: null,
      error: "Discovery Score is not configured on this environment.",
    };
  }

  const benchmarks = await fetchBenchmarkPeopleFromSumble(ctx);
  if (!benchmarks.length) {
    return {
      cached: false,
      configured,
      result: null,
      error: "Could not find benchmark profiles for your target roles. Add target roles and skills, then try again.",
    };
  }

  const enriched = await enrichBenchmarksWithApify(benchmarks, userId);
  const computed = computeDiscoveryScoreFromCohort(ctx, enriched);
  const payload: DiscoveryScoreCachePayload = {
    version: 1,
    fingerprint,
    refreshedAt: new Date().toISOString(),
    ...computed,
  };

  const existingParsed =
    profile.parsedData && typeof profile.parsedData === "object"
      ? (profile.parsedData as Record<string, unknown>)
      : {};
  const nextParsed = writeDiscoveryScoreCache(existingParsed, payload);

  await prisma.profile.update({
    where: { userId },
    data: { parsedData: nextParsed },
  });

  return { cached: false, configured, result: payload };
}
