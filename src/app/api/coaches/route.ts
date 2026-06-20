import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";

export async function GET() {
  const coaches = await prisma.coachProfile.findMany({
    where: { status: CoachStatus.ACTIVE },
    orderBy: [{ featured: "desc" }, { hourlyRate: "asc" }],
    select: {
      id: true,
      displayName: true,
      headline: true,
      bio: true,
      currentRole: true,
      currentCompany: true,
      location: true,
      linkedinUrl: true,
      lelandUrl: true,
      photoUrl: true,
      firms: true,
      schools: true,
      specialties: true,
      industries: true,
      hourlyRate: true,
      category: true,
      featured: true,
    },
  });

  return NextResponse.json(coaches);
}
