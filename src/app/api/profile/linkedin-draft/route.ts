import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import {
  buildEffectiveLinkedInDraftForUser,
  syncAboutFromLinkedInDraft,
} from "@/lib/profile-linkedin-persist";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { authUser, dbUser } = await getActingUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
    const targetRoles = (profile?.targetRoles as string[] | null) ?? [];
    const draft = buildEffectiveLinkedInDraftForUser({
      name: dbUser.name || authUser.email.split("@")[0] || "You",
      targetRoles,
      headline: profile?.headline,
      summary: profile?.summary,
      parsedData: profile?.parsedData,
      storedDraft: profile?.linkedInDraft,
      sourceAssetId: profile?.linkedInDraftSourceAssetId,
    });

    return NextResponse.json({
      draft,
      updatedAt: profile?.linkedInDraftUpdatedAt?.toISOString() ?? null,
      sourceAssetId: profile?.linkedInDraftSourceAssetId ?? null,
      linkedinUrl: profile?.linkedinUrl ?? null,
      name: dbUser.name || authUser.email.split("@")[0] || "You",
      avatarUrl: dbUser.avatarUrl ?? null,
      syncedFromAbout: true,
    });
  } catch (err) {
    console.error("[linkedin-draft GET]", err);
    return NextResponse.json({ error: "Failed to load LinkedIn draft" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { authUser, dbUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const draft = normalizeLinkedInDraft(body.draft);
  if (!draft) {
    return NextResponse.json({ error: "Invalid LinkedIn draft" }, { status: 400 });
  }

  await syncAboutFromLinkedInDraft(dbUser.id, draft);

  return NextResponse.json({ ok: true, draft, syncedToAbout: true });
}
