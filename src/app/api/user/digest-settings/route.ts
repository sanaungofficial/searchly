import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";

function serializeSettings(settings: {
  dailyEmailEnabled: boolean;
  watchlistEmailEnabled: boolean;
  pipelineEmailEnabled: boolean;
  lastDigestSentAt: Date | null;
  lastWatchlistSentAt: Date | null;
}) {
  return {
    dailyEmailEnabled: settings.dailyEmailEnabled,
    watchlistEmailEnabled: settings.watchlistEmailEnabled,
    pipelineEmailEnabled: settings.pipelineEmailEnabled,
    lastDigestSentAt: settings.lastDigestSentAt?.toISOString() ?? null,
    lastWatchlistSentAt: settings.lastWatchlistSentAt?.toISOString() ?? null,
  };
}

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.userDigestSettings.upsert({
    where: { userId: dbUser.id },
    create: { userId: dbUser.id },
    update: {},
  });

  return NextResponse.json(serializeSettings(settings));
}

export async function PATCH(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    dailyEmailEnabled?: boolean;
    watchlistEmailEnabled?: boolean;
    pipelineEmailEnabled?: boolean;
  };

  const hasAny =
    body.dailyEmailEnabled !== undefined ||
    body.watchlistEmailEnabled !== undefined ||
    body.pipelineEmailEnabled !== undefined;

  if (!hasAny) {
    return NextResponse.json({ error: "At least one email preference is required" }, { status: 400 });
  }

  const settings = await prisma.userDigestSettings.upsert({
    where: { userId: dbUser.id },
    create: {
      userId: dbUser.id,
      ...(body.dailyEmailEnabled !== undefined ? { dailyEmailEnabled: Boolean(body.dailyEmailEnabled) } : {}),
      ...(body.watchlistEmailEnabled !== undefined
        ? { watchlistEmailEnabled: Boolean(body.watchlistEmailEnabled) }
        : {}),
      ...(body.pipelineEmailEnabled !== undefined
        ? { pipelineEmailEnabled: Boolean(body.pipelineEmailEnabled) }
        : {}),
    },
    update: {
      ...(body.dailyEmailEnabled !== undefined ? { dailyEmailEnabled: Boolean(body.dailyEmailEnabled) } : {}),
      ...(body.watchlistEmailEnabled !== undefined
        ? { watchlistEmailEnabled: Boolean(body.watchlistEmailEnabled) }
        : {}),
      ...(body.pipelineEmailEnabled !== undefined
        ? { pipelineEmailEnabled: Boolean(body.pipelineEmailEnabled) }
        : {}),
    },
  });

  return NextResponse.json(serializeSettings(settings));
}
