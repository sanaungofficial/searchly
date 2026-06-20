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

function coachData(body: Record<string, unknown>) {
  const d: Record<string, unknown> = {};
  if (body.displayName !== undefined) d.displayName = body.displayName;
  if (body.email !== undefined) d.email = (body.email as string) || null;
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
  if (body.category !== undefined) d.category = (body.category as string) || null;
  if (body.featured !== undefined) d.featured = body.featured;
  if (body.status !== undefined) d.status = body.status as CoachStatus;
  return d;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const coach = await prisma.coachProfile.update({ where: { id }, data: coachData(body) });
  return NextResponse.json(coach);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.coachProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
