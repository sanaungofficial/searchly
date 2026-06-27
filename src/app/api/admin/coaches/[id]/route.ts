import { requireAdmin } from "@/lib/auth";
import { pushCoachProfileToAirtable } from "@/lib/airtable/push-coach";
import { ensureUniqueCoachSlug } from "@/lib/coach-slug";
import { parseSchedulerAvailabilityPatch, schedulerAvailabilityChanged } from "@/lib/coach-scheduler-settings";
import { syncCoachSchedulerFromProfile } from "@/lib/coach-scheduler-sync";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";

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
  if (body.calLink !== undefined) d.calLink = (body.calLink as string) || null;
  if (body.firms !== undefined) d.firms = body.firms;
  if (body.schools !== undefined) d.schools = body.schools;
  if (body.specialties !== undefined) d.specialties = body.specialties;
  if (body.industries !== undefined) d.industries = body.industries;
  if (body.hourlyRate !== undefined) d.hourlyRate = body.hourlyRate ? Number(body.hourlyRate) : null;
  if (body.category !== undefined) d.category = (body.category as string) || null;
  if (body.featured !== undefined) d.featured = body.featured;
  if (body.isInternal !== undefined) d.isInternal = Boolean(body.isInternal);
  if (body.status !== undefined) d.status = body.status as CoachStatus;
  if (body.clientSpecializations !== undefined) d.clientSpecializations = body.clientSpecializations;
  if (body.experienceLevel !== undefined) d.experienceLevel = (body.experienceLevel as string) || null;
  if (body.clientTier !== undefined) d.clientTier = (body.clientTier as string) || null;
  if (body.industryYears !== undefined) d.industryYears = body.industryYears != null ? Number(body.industryYears) : null;
  if (body.isProfessionalCoach !== undefined) d.isProfessionalCoach = Boolean(body.isProfessionalCoach);
  if (body.whyCoach !== undefined) d.whyCoach = (body.whyCoach as string) || null;
  if (body.aboutMe !== undefined) d.aboutMe = (body.aboutMe as string) || null;
  if (body.clientWins !== undefined && Array.isArray(body.clientWins)) {
    d.clientWins = (body.clientWins as string[]).map((w) => String(w).trim()).filter(Boolean);
  }
  Object.assign(d, parseSchedulerAvailabilityPatch(body));
  return d;
}

async function ensureSlug(
  profile: { id: string; displayName: string; slug: string | null },
  patch: Record<string, unknown>,
) {
  const name = (patch.displayName as string) ?? profile.displayName;
  if (!profile.slug || patch.displayName !== undefined) {
    patch.slug = await ensureUniqueCoachSlug(name, profile.id);
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const coach = await prisma.coachProfile.findUnique({ where: { id } });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  return NextResponse.json(coach);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.coachProfile.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const body = await req.json();
  const d = coachData(body);
  await ensureSlug(existing, d);

  const coach = await prisma.coachProfile.update({ where: { id }, data: d });

  if (schedulerAvailabilityChanged(body) && coach.nylasGrantId) {
    try {
      await syncCoachSchedulerFromProfile(coach.id);
    } catch (err) {
      console.error("[admin/coaches] scheduler sync", err);
    }
  }

  if (coach.airtableId) {
    try {
      await pushCoachProfileToAirtable(coach.id);
    } catch (err) {
      console.error("[admin/coaches] airtable push", err);
    }
  }

  return NextResponse.json(coach);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.coachProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
