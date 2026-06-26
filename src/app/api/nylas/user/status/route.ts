import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";
import { isNylasConfigured } from "@/lib/nylas";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";

export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [grant, settings] = await Promise.all([
    prisma.userEmailGrant.findUnique({ where: { userId: dbUser.id } }),
    ensureJobAgentSettings(dbUser.id),
  ]);

  return NextResponse.json({
    configured: isNylasConfigured(),
    connected: Boolean(grant?.nylasGrantId),
    email: grant?.email ?? null,
    provider: grant?.provider ?? null,
    connectedAt: grant?.connectedAt?.toISOString() ?? null,
    lastSyncAt: grant?.lastSyncAt?.toISOString() ?? null,
    agentEnabled: settings.enabled,
    autoApplyUpdates: settings.autoApplyUpdates,
  });
}
