import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrgMemberRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function parseRole(value: unknown): OrgMemberRole | null {
  if (value === "ADMIN" || value === "MEMBER") return value;
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orgId } = await params;
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const role = body.role === undefined ? OrgMemberRole.MEMBER : parseRole(body.role);
  if (!role) return NextResponse.json({ error: "role must be ADMIN or MEMBER" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No Kimchi user found for that email" }, { status: 404 });
  }

  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "User is already a member of this org" }, { status: 409 });
  }

  const member = await prisma.orgMember.create({
    data: {
      orgId,
      userId: user.id,
      role,
      invitedByUserId: admin.id,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      invitedBy: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    member: {
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      createdAt: member.createdAt.toISOString(),
      user: member.user,
      invitedBy: member.invitedBy,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const role = parseRole(body.role);
  if (!role) return NextResponse.json({ error: "role must be ADMIN or MEMBER" }, { status: 400 });

  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const updated = await prisma.orgMember.update({
    where: { id: member.id },
    data: { role },
    include: {
      user: { select: { id: true, email: true, name: true } },
      invitedBy: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    member: {
      id: updated.id,
      role: updated.role,
      joinedAt: updated.joinedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      user: updated.user,
      invitedBy: updated.invitedBy,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await prisma.orgMember.delete({ where: { id: member.id } });
  return NextResponse.json({ ok: true });
}
