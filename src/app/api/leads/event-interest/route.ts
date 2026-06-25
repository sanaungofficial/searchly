import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendEventInterestEmail } from "@/lib/email";
import { normalizeDashboardGoals } from "@/lib/dashboard-goals";
import type { EventInterestPayload } from "@/lib/event-interest-lead";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Feedback is not configured yet. Email us at hello@kimchi.so." },
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

  const body = (await request.json()) as EventInterestPayload;
  const topics = body.topics?.trim();
  if (!topics || topics.length < 3) {
    return NextResponse.json({ error: "Tell us what topics you'd like to see." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: { profile: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const goals = normalizeDashboardGoals(dbUser.profile?.dashboardGoals);

  try {
    await sendEventInterestEmail(
      {
        userId: dbUser.id,
        name: dbUser.name,
        email: user.email,
        targetRoles: dbUser.profile?.targetRoles ?? [],
        dashboardGoals: goals.map((g) => g.label),
      },
      { topics, notes: body.notes },
    );
  } catch (e) {
    console.error("[event-interest]", e);
    return NextResponse.json({ error: "Could not send feedback. Try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
