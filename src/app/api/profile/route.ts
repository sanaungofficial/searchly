import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });

  return NextResponse.json({
    name: dbUser?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "You",
    email: user.email,
    resumeUrl: dbUser?.profile?.resumeUrl || null,
    linkedinUrl: dbUser?.profile?.linkedinUrl || null,
    headline: dbUser?.profile?.headline || null,
    targetRoles: dbUser?.profile?.targetRoles || [],
    parsedData: dbUser?.profile?.parsedData || null,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, headline, linkedinUrl, targetRoles, parsedData } = body;

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (name !== undefined) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name } });
  }

  const profileUpdate: Record<string, unknown> = {};
  if (headline !== undefined) profileUpdate.headline = headline;
  if (linkedinUrl !== undefined) profileUpdate.linkedinUrl = linkedinUrl;
  if (targetRoles !== undefined) profileUpdate.targetRoles = targetRoles;
  if (parsedData !== undefined) profileUpdate.parsedData = parsedData;

  if (Object.keys(profileUpdate).length > 0) {
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: profileUpdate,
      create: { userId: dbUser.id, ...profileUpdate, targetRoles: (profileUpdate.targetRoles as string[]) || [] },
    });
  }

  return NextResponse.json({ ok: true });
}
