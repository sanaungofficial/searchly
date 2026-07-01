import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { readClientUserIdFromRequest, resolveAdminClientSubject } from "@/lib/admin-client-subject";
import { mergeParsedDataPreservingDiscoveryCache } from "@/lib/discovery-score/persist";
import {
  readRoleCorpusGaps,
  refreshRoleCorpusGaps,
  writeRoleCorpusGaps,
} from "@/lib/job-corpus-gaps";
import { prisma } from "@/lib/prisma";
import { migrateLegacyRoleFields } from "@/lib/target-roles-unified";
import { upsertProfileFields } from "@/lib/profile-write";

export async function GET(request: Request) {
  try {
    const acting = await getActingUser(request);
    const { authUser } = acting;
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientUserId = readClientUserIdFromRequest(request);
    const resolved = await resolveAdminClientSubject(acting, clientUserId);
    if (resolved.error) return resolved.error;
    const dbUser = resolved.subject;
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const profile = await prisma.profile.findUnique({
      where: { userId: dbUser.id },
      select: { parsedData: true },
    });

    const cache = readRoleCorpusGaps(profile?.parsedData);
    return NextResponse.json({ roleCorpusGaps: cache });
  } catch (err) {
    console.error("[profile/role-corpus-gaps GET]", err);
    return NextResponse.json({ error: "Failed to load role corpus gaps" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const acting = await getActingUser(request);
    const { authUser } = acting;
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientUserId = readClientUserIdFromRequest(request);
    const resolved = await resolveAdminClientSubject(acting, clientUserId);
    if (resolved.error) return resolved.error;
    const dbUser = resolved.subject;
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const profile = await prisma.profile.findUnique({
      where: { userId: dbUser.id },
      select: { targetRoles: true, prioritizedRoles: true, parsedData: true, readbackData: true },
    });

    const roleFields = migrateLegacyRoleFields({
      targetRoles: profile?.targetRoles,
      prioritizedRoles: profile?.prioritizedRoles,
    });

    const cache = await refreshRoleCorpusGaps({
      userId: dbUser.id,
      targetRoles: roleFields.targetRoles,
      parsedData: profile?.parsedData,
      readbackData: profile?.readbackData,
    });

    const existingParsed =
      profile?.parsedData && typeof profile.parsedData === "object"
        ? (profile.parsedData as Record<string, unknown>)
        : {};
    const nextParsed = writeRoleCorpusGaps(existingParsed, cache);
    const mergedParsed = mergeParsedDataPreservingDiscoveryCache(nextParsed, profile?.parsedData);

    await upsertProfileFields(dbUser.id, { parsedData: mergedParsed });

    return NextResponse.json({ roleCorpusGaps: cache });
  } catch (err) {
    console.error("[profile/role-corpus-gaps POST]", err);
    return NextResponse.json({ error: "Failed to refresh role corpus gaps" }, { status: 500 });
  }
}
