import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

async function getCoachUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true, role: true, email: true } });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;
  return dbUser;
}

async function findAndLinkProfile(dbUser: { id: string; email: string }) {
  let profile = await prisma.coachProfile.findUnique({ where: { userId: dbUser.id } });
  if (!profile) {
    profile = await prisma.coachProfile.findUnique({ where: { email: dbUser.email } });
    if (profile) {
      profile = await prisma.coachProfile.update({ where: { id: profile.id }, data: { userId: dbUser.id } });
    }
  }
  return profile;
}

export async function GET() {
  const me = await getCoachUser();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await findAndLinkProfile(me);
  return NextResponse.json(profile ?? null);
}

export async function PATCH(req: NextRequest) {
  const me = await getCoachUser();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await findAndLinkProfile(me);
  if (!profile) return NextResponse.json({ error: "No coach profile found" }, { status: 404 });

  const body = await req.json();
  const d: Record<string, unknown> = {};
  if (body.displayName !== undefined) d.displayName = body.displayName;
  if (body.headline !== undefined) d.headline = (body.headline as string) || null;
  if (body.bio !== undefined) d.bio = (body.bio as string) || null;
  if (body.currentRole !== undefined) d.currentRole = (body.currentRole as string) || null;
  if (body.currentCompany !== undefined) d.currentCompany = (body.currentCompany as string) || null;
  if (body.location !== undefined) d.location = (body.location as string) || null;
  if (body.linkedinUrl !== undefined) d.linkedinUrl = (body.linkedinUrl as string) || null;
  if (body.lelandUrl !== undefined) d.lelandUrl = (body.lelandUrl as string) || null;
  if (body.photoUrl !== undefined) d.photoUrl = (body.photoUrl as string) || null;
  if (body.firms !== undefined) d.firms = body.firms;
  if (body.schools !== undefined) d.schools = body.schools;
  if (body.specialties !== undefined) d.specialties = body.specialties;
  if (body.industries !== undefined) d.industries = body.industries;
  if (body.hourlyRate !== undefined) d.hourlyRate = body.hourlyRate ? Number(body.hourlyRate) : null;

  const updated = await prisma.coachProfile.update({ where: { id: profile.id }, data: d });
  return NextResponse.json(updated);
}
