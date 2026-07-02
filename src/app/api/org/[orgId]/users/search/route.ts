import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { prisma } from "@/lib/prisma";
import { searchKimchiUsers, type UserSearchContext } from "@/lib/user-search";
import { NextRequest, NextResponse } from "next/server";

function parseContext(value: string | null): UserSearchContext | undefined {
  if (value === "member" || value === "client") return value;
  return undefined;
}

/** GET /api/org/[orgId]/users/search?q= — org-admin user lookup by name or email. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const context = parseContext(req.nextUrl.searchParams.get("context")) ?? "client";

  const users = await searchKimchiUsers({ query: q, orgId, context });
  return NextResponse.json({ users });
}
