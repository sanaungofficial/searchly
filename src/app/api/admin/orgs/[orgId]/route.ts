import { requireAdmin } from "@/lib/auth";
import { ensureUniqueOrgSlug } from "@/lib/org-slug";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function serializeMember(member: {
  id: string;
  role: string;
  joinedAt: Date;
  createdAt: Date;
  user: { id: string; email: string; name: string | null };
  invitedBy: { id: string; email: string; name: string | null } | null;
}) {
  return {
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    createdAt: member.createdAt.toISOString(),
    user: member.user,
    invitedBy: member.invitedBy,
  };
}

function serializeOrg(org: {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    website: org.website,
    logoUrl: org.logoUrl,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    include: {
      members: {
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: {
          user: { select: { id: true, email: true, name: true } },
          invitedBy: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  return NextResponse.json({
    org: serializeOrg(org),
    members: org.members.map(serializeMember),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const existing = await prisma.org.findUnique({ where: { id: orgId } });
  if (!existing) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    slug?: string;
    website?: string | null;
    logoUrl?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body.website !== undefined) {
    data.website = typeof body.website === "string" && body.website.trim() ? body.website.trim() : null;
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl = typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null;
  }
  if (body.slug !== undefined) {
    const slug = String(body.slug).trim();
    if (!slug) return NextResponse.json({ error: "slug cannot be empty" }, { status: 400 });
    data.slug = slug;
  } else if (data.name && data.name !== existing.name) {
    data.slug = await ensureUniqueOrgSlug(data.name, orgId);
  }

  const org = await prisma.org.update({
    where: { id: orgId },
    data,
    include: { _count: { select: { members: true } } },
  });

  return NextResponse.json({
    ...serializeOrg(org),
    memberCount: org._count.members,
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const existing = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  await prisma.org.delete({ where: { id: orgId } });
  return NextResponse.json({ ok: true });
}
