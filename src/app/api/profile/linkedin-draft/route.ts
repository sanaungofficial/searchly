import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInDraft, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const draft = normalizeLinkedInDraft(dbUser.profile?.linkedInDraft ?? null);

  return NextResponse.json({
    draft,
    updatedAt: dbUser.profile?.linkedInDraftUpdatedAt?.toISOString() ?? null,
    sourceAssetId: dbUser.profile?.linkedInDraftSourceAssetId ?? null,
    linkedinUrl: dbUser.profile?.linkedinUrl ?? null,
    name: dbUser.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "You",
    avatarUrl: dbUser.avatarUrl ?? null,
  });
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

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
    create: {
      userId: dbUser.id,
      targetRoles: [],
      priorities: [],
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, draft });
}
