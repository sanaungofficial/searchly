import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { digestUnsubscribeUrl } from "@/lib/digest-unsubscribe";
import { prisma } from "@/lib/prisma";
import { readRecommendedSnapshot, runRecommendedJobsSnapshotCron } from "@/lib/recommended-jobs-snapshot";
import { sendRecommendedJobsDigestEmail } from "@/lib/recommended-jobs-email";
import { utcSnapshotDate } from "@/lib/recommended-jobs-config";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

/** Admin: send a test job-match digest to yourself, or trigger the full cron. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set — add it in Vercel env vars first." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: "self" | "cron" };
  const mode = body.mode === "cron" ? "cron" : "self";

  if (mode === "cron") {
    const summary = await runRecommendedJobsSnapshotCron();
    return NextResponse.json({ ok: true, mode, summary });
  }

  const snapshotDate = utcSnapshotDate();
  const snapshot = await readRecommendedSnapshot(admin.id, snapshotDate);
  let jobs: VectorMatchedJob[] = snapshot?.jobs ?? [];

  if (!jobs.length) {
    const { generateRecommendedJobsForUser } = await import("@/lib/recommended-jobs-engine");
    const generated = await generateRecommendedJobsForUser({
      userId: admin.id,
      preferCache: true,
    });
    jobs = generated?.jobs ?? [];
  }

  if (!jobs.length) {
    return NextResponse.json(
      {
        error:
          "No recommended jobs found for your account. Complete your profile and upload a resume, then try again.",
      },
      { status: 404 },
    );
  }

  const topJobs = [...jobs]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  const sent = await sendRecommendedJobsDigestEmail({
    email: admin.email,
    name: admin.name,
    jobs: topJobs,
    totalNew: topJobs.length,
    unsubscribeUrl: digestUnsubscribeUrl(admin.id),
  });

  if (!sent) {
    return NextResponse.json({ error: "Resend send failed — check API key and domain verification." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: "self",
    sentTo: admin.email,
    jobCount: topJobs.length,
    jobs: topJobs.map((j) => ({
      title: j.title,
      company: j.companyName,
      score: j.matchScore,
      reasons: j.matchReasons?.slice(0, 2),
    })),
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    hirebaseConfigured: Boolean(process.env.HIREBASE_API_KEY),
    digestMinScore: process.env.RECOMMENDED_DIGEST_MIN_SCORE ?? "60 (default)",
    cronSchedule: "0 8 * * * UTC (daily 8am UTC)",
    maxJobsPerEmail: 3,
  });
}
