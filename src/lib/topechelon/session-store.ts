import { prisma } from "@/lib/prisma";
import type { TopEchelonSessionData } from "@/lib/topechelon/types";

const SESSION_ID = "default";

export async function loadTopEchelonSession(): Promise<TopEchelonSessionData | null> {
  const row = await prisma.topEchelonSession.findUnique({ where: { id: SESSION_ID } });
  if (!row) return null;
  return {
    cookies: row.cookies as TopEchelonSessionData["cookies"],
    tokenPayload: (row.tokenPayload as TopEchelonSessionData["tokenPayload"]) ?? null,
  };
}

export async function saveTopEchelonSession(session: TopEchelonSessionData): Promise<void> {
  await prisma.topEchelonSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      cookies: session.cookies,
      tokenPayload: session.tokenPayload ?? undefined,
    },
    update: {
      cookies: session.cookies,
      tokenPayload: session.tokenPayload ?? undefined,
    },
  });
}

export async function recordTopEchelonSyncResult(ok: boolean, error?: string): Promise<void> {
  await prisma.topEchelonSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      cookies: [],
      lastSyncAt: ok ? new Date() : undefined,
      lastSyncError: ok ? null : error ?? "Sync failed",
    },
    update: {
      lastSyncAt: ok ? new Date() : undefined,
      lastSyncError: ok ? null : error ?? "Sync failed",
    },
  });
}

export async function getTopEchelonSyncStatus() {
  const row = await prisma.topEchelonSession.findUnique({ where: { id: SESSION_ID } });
  const jobCount = await prisma.networkJob.count();
  return {
    hasSession: !!(row?.tokenPayload && typeof row.tokenPayload === "object"),
    lastSyncAt: row?.lastSyncAt ?? null,
    lastSyncError: row?.lastSyncError ?? null,
    jobCount,
  };
}
