import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.trackedCompany.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await prisma.trackedCompany.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.website !== undefined && { website: body.website }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.hqLocation !== undefined && { hqLocation: body.hqLocation }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.cultureMission !== undefined && { cultureMission: body.cultureMission }),
      ...(body.candidateEdge !== undefined && { candidateEdge: body.candidateEdge }),
      ...(body.targetRoles !== undefined && { targetRoles: body.targetRoles }),
      ...(body.careersUrl !== undefined && { careersUrl: body.careersUrl }),
    },
  });

  return NextResponse.json(company);
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
