import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  digestEmailAdminStatus,
  getDigestSettingsSummary,
  previewDigestEmailForAdmin,
  sendDigestEmailForAdmin,
} from "@/lib/digest-email-admin";

/** Admin: preview or send job-match digest emails (testing only — does not enable live cron). */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "preview" | "send";
    useSample?: boolean;
    to?: string;
  };

  const action = body.action === "send" ? "send" : "preview";
  const useSample = Boolean(body.useSample);

  if (action === "preview") {
    const preview = await previewDigestEmailForAdmin(admin.id, admin.name, useSample);
    return NextResponse.json({
      ok: true,
      action: "preview",
      subject: preview.subject,
      html: preview.html,
      source: preview.source,
      totalNew: preview.totalNew,
      jobs: preview.jobs.map((j) => ({
        title: j.title,
        company: j.companyName,
        score: j.matchScore,
        label: j.matchLabel,
        reasons: j.matchReasons?.slice(0, 2),
      })),
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set — add it in Vercel env vars first." },
      { status: 503 },
    );
  }

  const to = body.to?.trim() || admin.email;
  const result = await sendDigestEmailForAdmin({
    userId: admin.id,
    name: admin.name,
    to,
    useSample,
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: "Resend send failed — check API key and that hello@kimchi.so is verified." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    action: "send",
    sentTo: to,
    source: result.source,
    totalNew: result.totalNew,
    jobs: result.jobs.map((j) => ({
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

  const summary = await getDigestSettingsSummary();

  return NextResponse.json({
    adminEmail: admin.email,
    ...digestEmailAdminStatus(),
    usersWithDigestEnabled: summary.enabledCount,
    digestsSentToday: summary.sentToday,
  });
}
