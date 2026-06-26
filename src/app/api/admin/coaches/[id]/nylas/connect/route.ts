import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  attachNylasOAuthCookie,
  buildNylasAuthUrl,
  isNylasConfigured,
  resolveKimchiAppUrl,
  signNylasOAuthState,
} from "@/lib/nylas";

function adminCoachReturnPath(coachProfileId: string) {
  return `/admin/coaches?coachId=${encodeURIComponent(coachProfileId)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const appUrl = resolveKimchiAppUrl(req);
  const { id: coachProfileId } = await params;

  if (!isNylasConfigured()) {
    const qs = new URLSearchParams({ nylas: "error", reason: "config" }).toString();
    return NextResponse.redirect(`${appUrl}${adminCoachReturnPath(coachProfileId)}?${qs}`);
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, email: true },
  });
  if (!coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const provider = req.nextUrl.searchParams.get("provider") === "microsoft" ? "microsoft" : "google";
  const oauthPayload = {
    kind: "coach" as const,
    coachProfileId: coach.id,
    ts: Date.now(),
    returnAppUrl: appUrl,
    returnPath: adminCoachReturnPath(coach.id),
  };
  const state = signNylasOAuthState(oauthPayload);

  try {
    const url = buildNylasAuthUrl({
      provider,
      state,
      loginHint: coach.email ?? undefined,
    });
    const response = NextResponse.redirect(url);
    attachNylasOAuthCookie(response, oauthPayload);
    return response;
  } catch (err) {
    console.error("[admin coaches nylas connect]", err);
    const reason =
      err instanceof Error && (err.message.includes("RedirectURI") || err.message.includes("redirect"))
        ? "redirect"
        : "setup";
    const qs = new URLSearchParams({ nylas: "error", reason }).toString();
    return NextResponse.redirect(`${appUrl}${adminCoachReturnPath(coach.id)}?${qs}`);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const { id: coachProfileId } = await params;
  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, email: true },
  });
  if (!coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const provider = body.provider === "microsoft" ? "microsoft" : "google";
  const appUrl = resolveKimchiAppUrl(req);
  const oauthPayload = {
    kind: "coach" as const,
    coachProfileId: coach.id,
    ts: Date.now(),
    returnAppUrl: appUrl,
    returnPath: adminCoachReturnPath(coach.id),
  };
  const state = signNylasOAuthState(oauthPayload);

  try {
    const url = buildNylasAuthUrl({
      provider,
      state,
      loginHint: coach.email ?? undefined,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[admin coaches nylas connect]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nylas connect failed" },
      { status: 502 },
    );
  }
}
