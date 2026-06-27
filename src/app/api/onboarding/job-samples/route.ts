import { getActingUser } from "@/lib/acting-user";
import type { OnboardingJobSample } from "@/lib/onboarding-coach/types";
import { fetchRecommendedFromProfileRoles } from "@/lib/recommended-jobs-fallback";
import { sampleDigestPreviewJobs } from "@/lib/recommended-jobs-email-samples";
import { NextResponse } from "next/server";

function samplesFromFallback(): OnboardingJobSample[] {
  return sampleDigestPreviewJobs().slice(0, 3).map((job) => ({
    title: job.title,
    companyName: job.companyName,
    location: job.location,
    matchLabel: job.matchLabel,
    matchScore: job.matchScore,
  }));
}

export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { roles?: unknown };
  const roles = Array.isArray(body.roles)
    ? body.roles.filter((r): r is string => typeof r === "string" && r.trim().length > 0).slice(0, 3)
    : [];

  if (!roles.length) {
    return NextResponse.json({ samples: samplesFromFallback(), preview: true });
  }

  try {
    const { sources } = await fetchRecommendedFromProfileRoles({
      profileTargetRoles: roles,
      maxJobs: 3,
    });

    if (!sources.length) {
      return NextResponse.json({ samples: samplesFromFallback(), preview: true });
    }

    const samples: OnboardingJobSample[] = sources.slice(0, 3).map((entry) => ({
      title: entry.cached.title,
      companyName: entry.companyName,
      location: entry.cached.location,
      matchLabel: null,
      matchScore: null,
    }));

    return NextResponse.json({ samples, preview: false });
  } catch {
    return NextResponse.json({ samples: samplesFromFallback(), preview: true });
  }
}
