import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse, after } from "next/server";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { mergeTrackedWithIntel } from "@/lib/company-intel";
import { scanTrackedCompanyMatches } from "@/lib/company-jobs-scan";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.trackedCompany.findFirst({
    where: { id, userId: dbUser.id },
    include: { companyIntel: true },
  });
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

  if (body.targetRoles !== undefined) {
    after(async () => {
      await scanTrackedCompanyMatches(id, dbUser.id).catch((err) => {
        console.error("[companies PATCH targetRoles scan]", err);
      });
    });
  }

  return NextResponse.json(mergeTrackedWithIntel(company, existing.companyIntel));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const company = await prisma.trackedCompany.findUnique({ where: { id } });
  if (!company || company.userId !== dbUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.trackedCompany.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
