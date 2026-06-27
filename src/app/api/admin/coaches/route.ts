import { requireAdmin } from "@/lib/auth";
import { ensureUniqueCoachSlug } from "@/lib/coach-slug";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const coaches = await prisma.coachProfile.findMany({
    orderBy: [{ status: "asc" }, { featured: "desc" }, { displayName: "asc" }],
  });
  return NextResponse.json(coaches);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.displayName) return NextResponse.json({ error: "displayName required" }, { status: 400 });

  const coach = await prisma.coachProfile.create({
    data: {
      displayName: body.displayName,
      email: body.email || null,
      headline: body.headline || null,
      bio: body.bio || null,
      currentRole: body.currentRole || null,
      currentCompany: body.currentCompany || null,
      location: body.location || null,
      linkedinUrl: body.linkedinUrl || null,
      lelandUrl: body.lelandUrl || null,
      photoUrl: body.photoUrl || null,
      calLink: body.calLink || null,
      firms: body.firms ?? [],
      schools: body.schools ?? [],
      specialties: body.specialties ?? [],
      industries: body.industries ?? [],
      hourlyRate: body.hourlyRate ? Number(body.hourlyRate) : null,
      category: body.category || null,
      featured: body.featured ?? false,
      isInternal: body.isInternal ?? false,
      status: (body.status as CoachStatus) ?? CoachStatus.ACTIVE,
    },
  });
  const slug = await ensureUniqueCoachSlug(coach.displayName, coach.id);
  const updated = await prisma.coachProfile.update({ where: { id: coach.id }, data: { slug } });
  return NextResponse.json(updated);
}
