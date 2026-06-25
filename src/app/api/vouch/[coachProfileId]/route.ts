import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ coachProfileId: string }> }) {
  const { coachProfileId } = await params;
  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: {
      id: true,
      displayName: true,
      photoUrl: true,
      category: true,
      headline: true,
      bio: true,
      status: true,
      currentRole: true,
      currentCompany: true,
      location: true,
      linkedinUrl: true,
      specialties: true,
      industries: true,
      firms: true,
      schools: true,
    },
  });
  if (!profile) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const vouchCount = await prisma.coachVouch.count({ where: { coachProfileId: profile.id } });

  return NextResponse.json({ ...profile, vouchCount });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ coachProfileId: string }> }) {
  const { coachProfileId } = await params;
  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true, displayName: true },
  });
  if (!profile) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const authorEmail = typeof body.authorEmail === "string" ? body.authorEmail.trim() || null : null;
  const relationship = typeof body.relationship === "string" ? body.relationship.trim() || null : null;

  if (!authorName || authorName.length < 2) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  if (!message || message.length < 20) {
    return NextResponse.json({ error: "Please write at least a few sentences about your experience" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const vouch = await prisma.coachVouch.create({
    data: { coachProfileId: profile.id, authorName, authorEmail, relationship, message },
  });

  const vouchCount = await prisma.coachVouch.count({ where: { coachProfileId: profile.id } });

  return NextResponse.json({ ok: true, id: vouch.id, vouchCount });
}
