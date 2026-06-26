import { requireAdmin } from "@/lib/auth";
import { pushCoachProfileToAirtable } from "@/lib/airtable/push-coach";
import { applyCoachPricingPatch, serializePricing } from "@/lib/coach-pricing-api";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const profile = await prisma.coachProfile.findUnique({
    where: { id },
    include: {
      pricingPackages: { orderBy: { sortOrder: "asc" } },
      bulkDiscounts: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!profile) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  return NextResponse.json(serializePricing(profile));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const exists = await prisma.coachProfile.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const fresh = await applyCoachPricingPatch(id, body);
  if (!fresh) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (fresh.airtableId) {
    try {
      await pushCoachProfileToAirtable(fresh.id);
    } catch (err) {
      console.error("[admin/coaches/pricing] airtable push", err);
    }
  }

  return NextResponse.json(serializePricing(fresh));
}
