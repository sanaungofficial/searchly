import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import { getWorkInboxAvailability } from "@/lib/inbox-lens";
import { isNylasConfigured } from "@/lib/nylas";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [grant, settings, work] = await Promise.all([
    prisma.userEmailGrant.findUnique({ where: { userId: dbUser.id } }),
    ensureJobAgentSettings(dbUser.id),
    getWorkInboxAvailability(dbUser.id, dbUser.role, dbUser.email),
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
    isStaff: work.available,
    workConnectPath: dbUser.role === "ADMIN" ? "/admin/profile" : "/dashboard/expert-profile",
    workInbox: {
      available: work.available,
      connected: work.connected,
      email: work.email,
    },
    jobInbox: {
      connected: Boolean(grant?.nylasGrantId),
      email: grant?.email ?? null,
      provider: grant?.provider ?? null,
    },
  });
}
