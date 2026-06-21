import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

// GET /api/jobs — list all jobs for current user
export async function GET() {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

// POST /api/jobs — create a new job
export async function POST(request: Request) {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company, role, url, stage, notes } = body;

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      userId: dbUser.id,
      company,
      role,
      url: url ?? null,
      stage: stage ?? "SAVED",
      notes: notes ?? null,
    },
  });

  return NextResponse.json(job, { status: 201 });
}
