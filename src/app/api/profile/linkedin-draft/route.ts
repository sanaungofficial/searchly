import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInDraft, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import {
  buildEffectiveLinkedInDraftForUser,
  syncAboutFromLinkedInDraft,
} from "@/lib/profile-linkedin-persist";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      include: { profile: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const targetRoles = (dbUser.profile?.targetRoles as string[] | null) ?? [];
    const draft = buildEffectiveLinkedInDraftForUser({
      name: dbUser.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "You",
      targetRoles,
      headline: dbUser.profile?.headline,
      summary: dbUser.profile?.summary,
      parsedData: dbUser.profile?.parsedData,
      storedDraft: dbUser.profile?.linkedInDraft,
      sourceAssetId: dbUser.profile?.linkedInDraftSourceAssetId,
    });

    return NextResponse.json({
      draft,
      updatedAt: dbUser.profile?.linkedInDraftUpdatedAt?.toISOString() ?? null,
      sourceAssetId: dbUser.profile?.linkedInDraftSourceAssetId ?? null,
      linkedinUrl: dbUser.profile?.linkedinUrl ?? null,
      name: dbUser.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "You",
      avatarUrl: dbUser.avatarUrl ?? null,
      syncedFromAbout: true,
    });
  } catch (err) {
    console.error("[linkedin-draft GET]", err);
    return NextResponse.json({ error: "Failed to load LinkedIn draft" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const draft = normalizeLinkedInDraft(body.draft);
  if (!draft) {
    return NextResponse.json({ error: "Invalid LinkedIn draft" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await syncAboutFromLinkedInDraft(dbUser.id, draft);

  return NextResponse.json({ ok: true, draft, syncedToAbout: true });
}
