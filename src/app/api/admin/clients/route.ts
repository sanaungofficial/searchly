import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await prisma.user.findMany({
    where: { role: UserRole.USER },
    include: {
      profile: {
        select: {
          headline: true,
          targetRoles: true,
          targetSalary: true,
          resumeUrl: true,
          linkedinUrl: true,
        },
      },
      subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
      jobs: {
        select: { id: true, company: true, role: true, stage: true, appliedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { jobs: true, tailoredResumes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}
