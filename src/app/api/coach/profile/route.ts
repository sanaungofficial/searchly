import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus, UserRole } from "@prisma/client";
import { coachProfileSlug } from "@/lib/coach-slug";
import { syncCoachSchedulerFromProfile } from "@/lib/coach-scheduler-sync";

async function getCoachUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, email: true, name: true },
  });
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

async function ensureCoachProfile(dbUser: { id: string; email: string; name: string | null }) {
  const existing = await findAndLinkProfile(dbUser);
  if (existing) return existing;

  const created = await prisma.coachProfile.create({
    data: {
      userId: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.name?.trim() || dbUser.email.split("@")[0],
      status: CoachStatus.PENDING,
    },
  });
  return prisma.coachProfile.update({
    where: { id: created.id },
    data: { slug: coachProfileSlug(created.displayName, created.id) },
  });
}

function profilePatchData(body: Record<string, unknown>) {
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
  if (body.category !== undefined) d.category = (body.category as string) || null;
  if (body.calLink !== undefined) d.calLink = (body.calLink as string) || null;
  if (body.schedulerDurationMinutes !== undefined) {
    const mins = Number(body.schedulerDurationMinutes);
    d.schedulerDurationMinutes = Number.isFinite(mins) ? Math.min(120, Math.max(15, Math.round(mins))) : 30;
  }
  if (body.clientSpecializations !== undefined) d.clientSpecializations = body.clientSpecializations;
  if (body.experienceLevel !== undefined) d.experienceLevel = (body.experienceLevel as string) || null;
  if (body.clientTier !== undefined) d.clientTier = (body.clientTier as string) || null;
  if (body.industryYears !== undefined) d.industryYears = body.industryYears != null ? Number(body.industryYears) : null;
  if (body.isProfessionalCoach !== undefined) d.isProfessionalCoach = Boolean(body.isProfessionalCoach);
  if (body.whyCoach !== undefined) d.whyCoach = (body.whyCoach as string) || null;
  if (body.aboutMe !== undefined) d.aboutMe = (body.aboutMe as string) || null;
  return d;
}

function ensureSlug(profile: { id: string; displayName: string; slug: string | null }, patch: Record<string, unknown>) {
  const name = (patch.displayName as string) ?? profile.displayName;
  if (!profile.slug || patch.displayName !== undefined) {
    patch.slug = coachProfileSlug(name, profile.id);
  }
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

  const body = await req.json();
  const profile = await ensureCoachProfile(me);
  const d = profilePatchData(body);
  ensureSlug(profile, d);

  if (body.submitForReview) {
    d.status = CoachStatus.PENDING;
  }

  const updated = await prisma.coachProfile.update({ where: { id: profile.id }, data: d });

  if (body.schedulerDurationMinutes !== undefined && updated.nylasGrantId) {
    try {
      await syncCoachSchedulerFromProfile(updated.id);
    } catch (err) {
      console.error("[coach/profile] scheduler sync", err);
    }
  }

  const fresh = await prisma.coachProfile.findUnique({ where: { id: profile.id } });
  return NextResponse.json(fresh ?? updated);
}
