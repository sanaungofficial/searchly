import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getNetworkJobCatalogStats,
  loadNetworkJobCatalog,
} from "@/lib/network-jobs-load";
import type { NetworkJobSource } from "@prisma/client";

function parseSource(value: string | null): NetworkJobSource | undefined {
  if (value === "EXECTHREAD" || value === "TOPECHELON") return value;
  return undefined;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const source = parseSource(searchParams.get("source"));
  const q = searchParams.get("q") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "25");
  const statsOnly = searchParams.get("stats") === "1";

  if (statsOnly) {
    const stats = await getNetworkJobCatalogStats();
    return NextResponse.json({ ok: true, stats });
  }

  const catalog = await loadNetworkJobCatalog({ source, q, page, pageSize });
  const stats = await getNetworkJobCatalogStats();

  return NextResponse.json({
    ok: true,
    ...catalog,
    stats,
  });
}
