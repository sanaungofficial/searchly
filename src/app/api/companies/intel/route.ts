import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  const results = await prisma.companyIntel.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 8,
    orderBy: { name: "asc" },
    select: { name: true, enrichmentCache: true },
  });

  return NextResponse.json(results.map((r) => ({
    name: r.name,
    hasIntel: r.enrichmentCache !== null,
  })));
}
