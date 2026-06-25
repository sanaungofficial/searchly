import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { CoachStatus, UserRole } from "@prisma/client";
import { coachProfileSlug } from "@/lib/coach-slug";
import {
  attachNylasOAuthCookie,
  buildNylasAuthUrl,
  getNylasConfig,
  isNylasConfigured,
  nylasProfileReturnUrl,
  resolveKimchiAppUrl,
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
    if (profile) {
      profile = await prisma.coachProfile.update({
        where: { id: profile.id },
        data: { userId: dbUser.id },
      });
    }
  }

  if (!profile && dbUser.role === UserRole.ADMIN) {
    const created = await prisma.coachProfile.create({
      data: {
        userId: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.name?.trim() || dbUser.email.split("@")[0],
        status: dbUser.role === UserRole.ADMIN ? CoachStatus.ACTIVE : CoachStatus.PENDING,
      },
    });
    profile = await prisma.coachProfile.update({
      where: { id: created.id },
      data: { slug: coachProfileSlug(created.displayName, created.id) },
    });
  }

  if (!profile) return null;

  return { dbUser, profile };
}

export async function GET(req: NextRequest) {
  const appUrl = resolveKimchiAppUrl(req);
  const ctx = await getCoachProfileForUser();
  const returnRole = ctx?.dbUser.role === UserRole.COACH ? "COACH" : "ADMIN";

  if (!isNylasConfigured()) {
    return NextResponse.redirect(
      nylasProfileReturnUrl(appUrl, returnRole, { nylas: "error", reason: "config" }),
    );
  }

  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const provider = req.nextUrl.searchParams.get("provider") === "microsoft" ? "microsoft" : "google";
  const oauthPayload = { coachProfileId: ctx.profile.id, ts: Date.now(), returnAppUrl: appUrl };
  const state = signNylasState(oauthPayload);

  try {
    const url = buildNylasAuthUrl({
      provider,
      state,
      loginHint: ctx.profile.email ?? ctx.dbUser.email,
    });
    const response = NextResponse.redirect(url);
    attachNylasOAuthCookie(response, oauthPayload);
    return response;
  } catch (err) {
    console.error("[nylas/connect]", err);
    const message = err instanceof Error ? err.message : "Nylas connect failed";
    const reason = message.includes("RedirectURI") || message.includes("redirect")
      ? "redirect"
      : "setup";
    return NextResponse.redirect(
      nylasProfileReturnUrl(appUrl, returnRole, { nylas: "error", reason }),
    );
  }
}

export async function POST(req: NextRequest) {
  const appUrl = resolveKimchiAppUrl(req);

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const ctx = await getCoachProfileForUser();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { provider?: string };
  const provider = body.provider === "microsoft" ? "microsoft" : "google";
  const oauthPayload = { coachProfileId: ctx.profile.id, ts: Date.now(), returnAppUrl: appUrl };
  const state = signNylasState(oauthPayload);

  try {
    const url = buildNylasAuthUrl({
      provider,
      state,
      loginHint: ctx.profile.email ?? ctx.dbUser.email,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[nylas/connect]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nylas connect failed" },
      { status: 502 },
    );
  }
}
