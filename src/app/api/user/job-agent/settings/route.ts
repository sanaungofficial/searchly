import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await ensureJobAgentSettings(dbUser.id);
  return NextResponse.json({
    enabled: settings.enabled,
    autoApplyUpdates: settings.autoApplyUpdates,
  });
}

export async function PATCH(req: NextRequest) {
  const { dbUser } = await getActingUser(req);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    enabled?: boolean;
    autoApplyUpdates?: boolean;
  };

  const settings = await ensureJobAgentSettings(dbUser.id);

  const updated = await prisma.userJobAgentSettings.update({
    where: { id: settings.id },
    data: {
      ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
      ...(body.autoApplyUpdates !== undefined
        ? { autoApplyUpdates: Boolean(body.autoApplyUpdates) }
        : {}),
    },
  });

  return NextResponse.json({
    enabled: updated.enabled,
    autoApplyUpdates: updated.autoApplyUpdates,
  });
}
