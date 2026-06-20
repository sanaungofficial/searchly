import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

async function getDbUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function GET() {
  const me = await getDbUser();
  if (!me || (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN && me.role !== UserRole.RECRUITER)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await prisma.user.findMany({
    where: { role: UserRole.USER },
    include: {
      profile: { select: { headline: true, targetRoles: true, targetSalary: true, resumeUrl: true, linkedinUrl: true } },
      subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
      jobs: { select: { id: true, company: true, role: true, stage: true, appliedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { jobs: true, tailoredResumes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}
