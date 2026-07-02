import { requireAdmin } from "@/lib/auth";
import { ensureUniqueOrgSlug } from "@/lib/org-slug";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function serializeOrg(org: {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { members: number };
}) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    website: org.website,
    logoUrl: org.logoUrl,
    memberCount: org._count?.members ?? undefined,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgs = await prisma.org.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });

  return NextResponse.json({ orgs: orgs.map(serializeOrg) });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const website = typeof body.website === "string" && body.website.trim() ? body.website.trim() : null;
  const logoUrl = typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null;
  const slugInput = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : name;

  const org = await prisma.org.create({
    data: {
      name,
      slug: slugInput,
      website,
      logoUrl,
    },
  });

  const slug = await ensureUniqueOrgSlug(name, org.id);
  const updated = await prisma.org.update({
    where: { id: org.id },
    data: { slug },
    include: { _count: { select: { members: true } } },
  });

  return NextResponse.json(serializeOrg(updated));
}
