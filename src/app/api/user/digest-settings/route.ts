import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.userDigestSettings.upsert({
    where: { userId: dbUser.id },
    create: { userId: dbUser.id },
    update: {},
  });

  return NextResponse.json({
    dailyEmailEnabled: settings.dailyEmailEnabled,
    lastDigestSentAt: settings.lastDigestSentAt?.toISOString() ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { dailyEmailEnabled?: boolean };
  if (body.dailyEmailEnabled === undefined) {
    return NextResponse.json({ error: "dailyEmailEnabled is required" }, { status: 400 });
  }

  const settings = await prisma.userDigestSettings.upsert({
    where: { userId: dbUser.id },
    create: { userId: dbUser.id, dailyEmailEnabled: Boolean(body.dailyEmailEnabled) },
    update: { dailyEmailEnabled: Boolean(body.dailyEmailEnabled) },
  });

  return NextResponse.json({
    dailyEmailEnabled: settings.dailyEmailEnabled,
    lastDigestSentAt: settings.lastDigestSentAt?.toISOString() ?? null,
  });
}
