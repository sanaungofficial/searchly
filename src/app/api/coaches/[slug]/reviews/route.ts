import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getClientCoachingUser } from "@/lib/coach-api";

function clampRating(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1 || v > 5) return null;
  return Math.round(v);
}

async function resolveCoach(slug: string) {
  return prisma.coachProfile.findFirst({
    where: {
      status: CoachStatus.ACTIVE,
      OR: [{ slug }, { id: slug }],
    },
    select: { id: true, displayName: true },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await resolveCoach(slug);
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

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

  return NextResponse.json(
    reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const coach = await resolveCoach(slug);
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const coachedFor = typeof body.coachedFor === "string" ? body.coachedFor.trim() || null : null;
  const authorName =
    typeof body.authorName === "string" && body.authorName.trim()
      ? body.authorName.trim()
      : me.name?.trim() || me.email.split("@")[0];

  const knowledge = clampRating(body.knowledge);
  const value = clampRating(body.value);
  const responsiveness = clampRating(body.responsiveness);
  const supportiveness = clampRating(body.supportiveness);
  const ratingRaw = clampRating(body.rating);

  if (!message || message.length < 20) {
    return NextResponse.json({ error: "Please write at least a few sentences about your experience" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Review is too long" }, { status: 400 });
  }
  if (!knowledge || !value || !responsiveness || !supportiveness) {
    return NextResponse.json({ error: "All rating dimensions are required (1–5)" }, { status: 400 });
  }

  const rating = ratingRaw ?? (knowledge + value + responsiveness + supportiveness) / 4;

  const review = await prisma.coachReview.upsert({
    where: { coachProfileId_userId: { coachProfileId: coach.id, userId: me.id } },
    create: {
      coachProfileId: coach.id,
      userId: me.id,
      authorName,
      coachedFor,
      rating,
      knowledge,
      value,
      responsiveness,
      supportiveness,
      message,
    },
    update: {
      authorName,
      coachedFor,
      rating,
      knowledge,
      value,
      responsiveness,
      supportiveness,
      message,
    },
  });

  return NextResponse.json({
    ok: true,
    review: { ...review, createdAt: review.createdAt.toISOString() },
  });
}
