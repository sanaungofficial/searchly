import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import {
  createNylasAuthUrl,
  isNylasConfigured,
  signNylasState,
} from "@/lib/nylas";

async function getCoachProfileForUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, email: true, name: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;

  let profile = await prisma.coachProfile.findUnique({ where: { userId: dbUser.id } });
  if (!profile) {
    profile = await prisma.coachProfile.findUnique({ where: { email: dbUser.email } });
  }
  if (!profile) return null;

  return { dbUser, profile };
}

export async function GET(req: NextRequest) {
  if (!isNylasConfigured()) {
    const fallback = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";
    return NextResponse.redirect(`${fallback}/clients?tab=profile&nylas=error&reason=config`);
  }

  const ctx = await getCoachProfileForUser();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const provider = req.nextUrl.searchParams.get("provider") === "microsoft" ? "microsoft" : "google";
  const state = signNylasState({ coachProfileId: ctx.profile.id, ts: Date.now() });
  const url = await createNylasAuthUrl({
    provider,
    state,
    loginHint: ctx.profile.email ?? ctx.dbUser.email,
  });

  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const ctx = await getCoachProfileForUser();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { provider?: string };
  const provider = body.provider === "microsoft" ? "microsoft" : "google";
  const state = signNylasState({ coachProfileId: ctx.profile.id, ts: Date.now() });
  const url = await createNylasAuthUrl({
    provider,
    state,
    loginHint: ctx.profile.email ?? ctx.dbUser.email,
  });

  return NextResponse.json({ url });
}
