import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { isSumbleConfigured } from "@/lib/sumble/client";
import {
  loadInsiderConnections,
  userConnectionProfileFromProfile,
} from "@/lib/sumble/insider-connections";
import type { InsiderConnectionsJobContext } from "@/lib/sumble/types";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSumbleConfigured()) {
    return NextResponse.json({
      configured: false,
      companyName: "",
      sumbleOrganizationId: null,
      buckets: [],
      error: "Insider Connection is not configured yet.",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
  if (!companyName || !jobTitle) {
    return NextResponse.json({ error: "companyName and jobTitle are required" }, { status: 400 });
  }

  const job: InsiderConnectionsJobContext = {
    companyName,
    jobTitle,
    companyWebsite: typeof body.companyWebsite === "string" ? body.companyWebsite : null,
    linkedinUrl: typeof body.linkedinUrl === "string" ? body.linkedinUrl : null,
    jobTeam: typeof body.jobTeam === "string" ? body.jobTeam : null,
  };

  const profileRow = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profileRow?.parsedData ?? null),
    profileRow?.readbackData,
  );
  const linkedInDraft = normalizeLinkedInDraft(profileRow?.linkedInDraft ?? null);

  const userProfile = userConnectionProfileFromProfile({ parsedData, linkedInDraft });
  const result = await loadInsiderConnections({ job, profile: userProfile });

  return NextResponse.json(result);
}
