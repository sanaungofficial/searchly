import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendDiscoveryLeadEmail } from "@/lib/email";
import {
  DISCOVERY_BLOCKERS,
  type DiscoveryBlocker,
  type DiscoveryLeadPayload,
} from "@/lib/discovery-lead";
import { NextResponse } from "next/server";

const STAGE_LABELS: Record<string, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEW: "Interviewing",
  OFFER: "Offer",
  CLOSED: "Closed",
};

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Lead capture is not configured yet. Email us at hello@kimchi.so." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as DiscoveryLeadPayload;
  const blocker = body.blocker?.trim() as DiscoveryBlocker | undefined;

  if (!blocker || !DISCOVERY_BLOCKERS.includes(blocker)) {
    return NextResponse.json({ error: "Please select what's blocking you." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: {
      profile: true,
      jobs: { orderBy: { updatedAt: "desc" }, take: 8 },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const pipelineSummary =
    dbUser.jobs.length === 0
      ? "No jobs tracked yet"
      : dbUser.jobs
          .map((j) => `${j.role} at ${j.company} (${STAGE_LABELS[j.stage] ?? j.stage})`)
          .join("; ");

  try {
    await sendDiscoveryLeadEmail(
      {
        userId: dbUser.id,
        name: dbUser.name,
        email: user.email,
        targetRoles: dbUser.profile?.targetRoles ?? [],
        jobTimeline: dbUser.profile?.jobTimeline ?? null,
        targetSalary: dbUser.profile?.targetSalary ?? null,
        linkedinUrl: dbUser.profile?.linkedinUrl ?? null,
        pipelineSummary,
      },
      {
        blocker,
        targetCompanies: body.targetCompanies,
        phone: body.phone,
        preferredContactTime: body.preferredContactTime,
        notes: body.notes,
        trigger: body.trigger,
      },
    );
  } catch (e) {
    console.error("[discovery-lead]", e);
    return NextResponse.json({ error: "Could not send request. Try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
