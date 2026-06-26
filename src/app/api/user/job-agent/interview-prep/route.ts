import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { generateInterviewPrep } from "@/lib/job-email-agent";
import { isNylasConfigured } from "@/lib/nylas";

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { activityId?: string };
  if (!body.activityId?.trim()) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  try {
    const prep = await generateInterviewPrep(dbUser.id, body.activityId.trim());
    return NextResponse.json(prep);
  } catch (err) {
    console.error("[job-agent/interview-prep]", err);
    return NextResponse.json({ error: "Could not generate interview prep" }, { status: 500 });
  }
}
