import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureDbUser } from "@/lib/ensure-db-user";

const VALID_PRIORITIES = new Set(["HIGH", "MEDIUM", "LOW", ""]);

function parseIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const parsed = ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return parsed.length > 0 ? parsed : null;
}

function normalizePriority(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (!VALID_PRIORITIES.has(upper)) return null;
  return upper || null;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase, request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const ids = parseIds(body);
  if (!ids) return NextResponse.json({ error: "ids array is required" }, { status: 400 });

  if (!("priority" in body)) {
    return NextResponse.json({ error: "priority is required" }, { status: 400 });
  }

  const priority = normalizePriority(body.priority);
  if (body.priority !== null && body.priority !== undefined && priority === null && body.priority !== "") {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  try {
    const owned = await prisma.trackedCompany.findMany({
      where: { userId: dbUser.id, id: { in: ids } },
      select: { id: true },
    });
    const ownedIds = owned.map((row) => row.id);
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No matching companies found" }, { status: 404 });
    }

    const result = await prisma.trackedCompany.updateMany({
      where: { userId: dbUser.id, id: { in: ownedIds } },
      data: { priority },
    });

    return NextResponse.json({ updated: result.count, ids: ownedIds });
  } catch (err) {
    console.error("[companies bulk PATCH]", err);
    return NextResponse.json({ error: "Couldn't update priorities." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase, request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const ids = parseIds(body);
  if (!ids) return NextResponse.json({ error: "ids array is required" }, { status: 400 });

  try {
    const owned = await prisma.trackedCompany.findMany({
      where: { userId: dbUser.id, id: { in: ids } },
      select: { id: true },
    });
    const ownedIds = owned.map((row) => row.id);
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No matching companies found" }, { status: 404 });
    }

    const result = await prisma.trackedCompany.deleteMany({
      where: { userId: dbUser.id, id: { in: ownedIds } },
    });

    return NextResponse.json({ deleted: result.count, ids: ownedIds });
  } catch (err) {
    console.error("[companies bulk DELETE]", err);
    return NextResponse.json({ error: "Couldn't delete companies." }, { status: 500 });
  }
}
