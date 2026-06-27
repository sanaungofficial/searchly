import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { sendNetworkIntroRequestEmail } from "@/lib/email";
import {
  canViewNetworkJobInternalFromSession,
  sanitizeNetworkJobListing,
} from "@/lib/network-job-access";
import { networkAgencyDisplayName } from "@/lib/network-job-display";
import { networkJobHasRecruiter } from "@/lib/network-job-client-actions";
import { loadNetworkJobListingById } from "@/lib/network-jobs-load";
import { networkSourceChannelCode } from "@/lib/network-source-labels";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type IntroRequestBody = {
  notes?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Intro requests are not configured yet. Email us at hello@kimchi.so." },
      { status: 503 },
    );
  }

  const { jobId } = await params;
  const externalId = decodeURIComponent(jobId ?? "").trim();
  if (!externalId) {
    return NextResponse.json({ error: "Missing job id." }, { status: 400 });
  }

  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;

  const { dbUser, acting } = resolved;
  if (!dbUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalView = canViewNetworkJobInternalFromSession(
    acting.realDbUser,
    acting.realDbUser?.role === "ADMIN",
    acting.isImpersonating,
  );
  if (internalView) {
    return NextResponse.json(
      { error: "Intro requests are for clients — use partner links in staff view." },
      { status: 400 },
    );
  }

  const listing = await loadNetworkJobListingById(externalId);
  if (!listing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const job = sanitizeNetworkJobListing(listing, false);
  if (!networkJobHasRecruiter(job)) {
    return NextResponse.json(
      { error: "This role has no recruiter attached — save the job or apply directly if available." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as IntroRequestBody;
  const recruiter = job.recruiter ?? job.recruiters?.[0] ?? null;
  const profile = await prisma.profile.findUnique({
    where: { userId: dbUser.id },
    select: { targetRoles: true },
  });

  try {
    await sendNetworkIntroRequestEmail(
      {
        userId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        targetRoles: profile?.targetRoles ?? [],
      },
      {
        jobId: job.id,
        jobTitle: job.positionTitle,
        company: networkAgencyDisplayName(job),
        channel: networkSourceChannelCode(job.source),
        recruiterName: recruiter?.name ?? null,
        notes: body.notes,
      },
    );
  } catch (e) {
    console.error("[network-intro-request]", e);
    return NextResponse.json({ error: "Could not send intro request. Try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
