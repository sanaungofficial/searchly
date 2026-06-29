import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const coachListSelect = {
  id: true,
  slug: true,
  displayName: true,
  headline: true,
  bio: true,
  aboutMe: true,
  currentRole: true,
  currentCompany: true,
  location: true,
  photoUrl: true,
  firms: true,
  schools: true,
  specialties: true,
  industries: true,
  clientSpecializations: true,
  hourlyRate: true,
  category: true,
  featured: true,
  isProfessionalCoach: true,
  isInternal: true,
  requiresAssignment: true,
  calLink: true,
  linkedinUrl: true,
  nylasSchedulerConfigId: true,
  status: true,
  email: true,
  createdAt: true,
  _count: { select: { reviews: true, followers: true, clientAssignments: true } },
  reviews: { select: { rating: true } },
} as const;

function mapCoachRow(c: {
  id: string;
  slug: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  aboutMe: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  photoUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  clientSpecializations: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
  isProfessionalCoach: boolean;
  isInternal: boolean;
  requiresAssignment: boolean;
  calLink: string | null;
  linkedinUrl: string | null;
  nylasSchedulerConfigId: string | null;
  status: string;
  email: string | null;
  createdAt: Date;
  _count: { reviews: number; followers: number; clientAssignments: number };
  reviews: { rating: number }[];
}) {
  const avgRating =
    c.reviews.length > 0
      ? Math.round((c.reviews.reduce((sum, review) => sum + review.rating, 0) / c.reviews.length) * 10) / 10
      : null;

  return {
    id: c.id,
    slug: c.slug,
    displayName: c.displayName,
    headline: c.headline,
    bio: c.bio ?? c.aboutMe,
    aboutMe: c.aboutMe,
    currentRole: c.currentRole,
    currentCompany: c.currentCompany,
    location: c.location,
    photoUrl: c.photoUrl,
    firms: c.firms ?? [],
    schools: c.schools ?? [],
    specialties: c.specialties ?? [],
    industries: c.industries ?? [],
    clientSpecializations: c.clientSpecializations ?? [],
    hourlyRate: c.hourlyRate,
    category: c.category,
    featured: c.featured,
    isProfessionalCoach: c.isProfessionalCoach,
    isInternal: c.isInternal,
    requiresAssignment: c.requiresAssignment,
    calLink: c.calLink,
    linkedinUrl: c.linkedinUrl,
    nylasSchedulerConfigId: c.nylasSchedulerConfigId,
    hasNylasBooking: Boolean(c.nylasSchedulerConfigId),
    status: c.status,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    avgRating,
    reviewCount: c._count.reviews,
    followerCount: c._count.followers,
    assignedClientCount: c._count.clientAssignments,
  };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coaches = await prisma.coachProfile.findMany({
    orderBy: [{ status: "asc" }, { featured: "desc" }, { displayName: "asc" }],
    select: coachListSelect,
  });

  return NextResponse.json({ coaches: coaches.map(mapCoachRow) });
}
