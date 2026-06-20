import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) return null;
  return user;
}

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
      firms: body.firms ?? [],
      schools: body.schools ?? [],
      specialties: body.specialties ?? [],
      industries: body.industries ?? [],
      hourlyRate: body.hourlyRate ? Number(body.hourlyRate) : null,
      category: body.category || null,
      featured: body.featured ?? false,
      status: (body.status as CoachStatus) ?? CoachStatus.ACTIVE,
    },
  });
  return NextResponse.json(coach);
}
