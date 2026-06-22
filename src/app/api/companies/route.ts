import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function GET() {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.trackedCompany.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, website, notes, type, hqLocation, priority, cultureMission, candidateEdge, targetRoles } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const company = await prisma.trackedCompany.create({
    data: {
      userId: dbUser.id,
      name,
      website: website ?? null,
      notes: notes ?? null,
      type: type ?? null,
      hqLocation: hqLocation ?? null,
      priority: priority ?? null,
      cultureMission: cultureMission ?? null,
      candidateEdge: candidateEdge ?? null,
      targetRoles: targetRoles ?? null,
    },
  });

  return NextResponse.json(company, { status: 201 });
}
