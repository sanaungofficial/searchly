import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { disconnectCoachNylas } from "@/lib/coach-scheduler-sync";
import { isNylasConfigured } from "@/lib/nylas";

export async function POST() {
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await prisma.coachProfile.findFirst({
    where: { OR: [{ userId: dbUser.id }, { email: user.email }] },
    select: { id: true, nylasGrantId: true },
  });
  if (!profile?.nylasGrantId) return NextResponse.json({ ok: true });

  await disconnectCoachNylas(profile.id);
  return NextResponse.json({ ok: true });
}
