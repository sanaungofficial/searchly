import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus, UserRole } from "@prisma/client";
import {
  applyCoachPricingPatch,
  ensurePricingDefaults,
  pricingInclude,
  serializePricing,
} from "@/lib/coach-pricing-api";
import { coachProfileSlug } from "@/lib/coach-slug";
import { pushCoachProfileToAirtable } from "@/lib/airtable/push-coach";

async function getCoachUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
      profile = await prisma.coachProfile.update({
        where: { id: profile.id },
        data: { userId: dbUser.id },
      });
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

export async function GET() {
  const me = await getCoachUser();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await findAndLinkProfile(me);
  if (!profile) return NextResponse.json({ error: "No coach profile" }, { status: 404 });

  await ensurePricingDefaults(profile.id);

  const fresh = await prisma.coachProfile.findUnique({
    where: { id: profile.id },
    include: pricingInclude,
  });
  if (!fresh) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json(serializePricing(fresh));
}

export async function PATCH(req: NextRequest) {
  const me = await getCoachUser();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Record<string, unknown>;
  const profile = await ensureCoachProfile(me);

  const fresh = await applyCoachPricingPatch(profile.id, body);
  if (!fresh) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (fresh.airtableId) {
    try {
      await pushCoachProfileToAirtable(fresh.id);
    } catch (err) {
      console.error("[coach/pricing] airtable push", err);
    }
  }

  return NextResponse.json(serializePricing(fresh));
}
