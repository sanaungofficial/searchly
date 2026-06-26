import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { computeReviewAggregates } from "@/lib/coach-directory";
import { getCoachProfileForUser } from "@/lib/coach-hub";

async function getDbUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return prisma.user.findUnique({ where: { email: user.email } });
}

export async function GET() {
  const me = await getDbUser();
  if (!me || (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await getCoachProfileForUser(me.id, me.role);
  if (!profile) return NextResponse.json({ error: "Expert profile not found" }, { status: 404 });

  const coach = await prisma.coachProfile.findUnique({
    where: { id: profile.id },
    select: { id: true, slug: true, displayName: true },
  });
  if (!coach) return NextResponse.json({ error: "Expert profile not found" }, { status: 404 });

  const reviews = await prisma.coachReview.findMany({
    where: { coachProfileId: coach.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      authorName: true,
      coachedFor: true,
      rating: true,
      knowledge: true,
      value: true,
      responsiveness: true,
      supportiveness: true,
      message: true,
      createdAt: true,
    },
  });

  const mapped = reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  const aggregates = computeReviewAggregates(
    reviews.map((r) => ({
      rating: r.rating,
      knowledge: r.knowledge,
      value: r.value,
      responsiveness: r.responsiveness,
      supportiveness: r.supportiveness,
    })),
  );

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return NextResponse.json({
    slug: coach.slug,
    displayName: coach.displayName,
    reviews: mapped,
    aggregates,
    avgRating,
    reviewCount: reviews.length,
  });
}
