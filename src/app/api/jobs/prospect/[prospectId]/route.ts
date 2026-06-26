import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { fetchHirebaseJobById } from "@/lib/hirebase";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { decodeProspectPathId } from "@/lib/workspace-urls";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prospectId } = await params;
  const decoded = decodeProspectPathId(decodeURIComponent(prospectId));

  if (decoded.url) {
    return NextResponse.json({
      job: {
        title: "Saved job link",
        url: decoded.url,
      },
      companyName: null,
    });
  }

  if (!decoded.hirebaseId) {
    return NextResponse.json({ error: "Invalid prospect id" }, { status: 400 });
  }

  try {
    const result = await fetchHirebaseJobById(decoded.hirebaseId);
    if (!result) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { dbUser } = await resolveScopedDbUser(request);
    let match:
      | {
          matchScore: number;
          matchLabel: string;
          matchReasons: string[];
          matchedSkills?: string[];
          gapSkills?: string[];
        }
      | undefined;

    if (dbUser) {
      const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
      const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
      const parsedData = mergeParsedWithReadback(
        normalizeParsedResumeData(profile?.parsedData ?? null),
        profile?.readbackData,
      );
      const resumeText = profileTextForMatchReasons({
        headline: profile?.headline,
        targetRoles,
        resumeText: profile?.resumeText,
        parsedData,
        careerMotivation: profile?.careerMotivation,
        priorities: profile?.priorities ?? [],
        employmentStatus: profile?.employmentStatus,
        jobTimeline: profile?.jobTimeline,
        targetSalary: profile?.targetSalary
          ? Number.parseFloat(profile.targetSalary.replace(/[^0-9.]/g, "")) || null
          : null,
      });

      if (resumeText.trim().length >= 40) {
        const enriched = await enrichRecommendedSources(
          [{ raw: result.raw, cached: result.job, companyName: result.companyName }],
          resumeText,
          { heuristicOnly: true },
        );
        const scored = enriched[0];
        if (scored?.matchScore) {
          match = {
            matchScore: scored.matchScore,
            matchLabel: scored.matchLabel,
            matchReasons: scored.matchReasons,
            matchedSkills: scored.matchedSkills,
            gapSkills: scored.gapSkills,
          };
        }
      }
    }

    return NextResponse.json({ job: result.job, companyName: result.companyName, match });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load job";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
