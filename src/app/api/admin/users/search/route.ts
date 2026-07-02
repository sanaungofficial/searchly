import { requireAdmin } from "@/lib/auth";
import { searchKimchiUsers, type UserSearchContext } from "@/lib/user-search";
import { NextRequest, NextResponse } from "next/server";

function parseContext(value: string | null): UserSearchContext | undefined {
  if (value === "member" || value === "client") return value;
  return undefined;
}

/** GET /api/admin/users/search?q= — Kimchi user lookup by name or email. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const orgId = req.nextUrl.searchParams.get("orgId")?.trim() || undefined;
  const context = parseContext(req.nextUrl.searchParams.get("context"));

  if (context && !orgId) {
    return NextResponse.json({ error: "orgId is required when context is set" }, { status: 400 });
  }

  const users = await searchKimchiUsers({ query: q, orgId, context });
  return NextResponse.json({ users });
}
