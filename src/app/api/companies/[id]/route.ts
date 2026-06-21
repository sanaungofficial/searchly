import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const company = await prisma.trackedCompany.findUnique({ where: { id } });
  if (!company || company.userId !== dbUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.trackedCompany.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
