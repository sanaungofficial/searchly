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
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, headline, linkedinUrl, targetRoles } = body;

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (name !== undefined) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name } });
  }

  if (headline !== undefined || linkedinUrl !== undefined || targetRoles !== undefined) {
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: { headline, linkedinUrl, targetRoles },
      create: { userId: dbUser.id, headline, linkedinUrl, targetRoles: targetRoles || [] },
    });
  }

  return NextResponse.json({ ok: true });
}
