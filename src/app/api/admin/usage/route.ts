import { requireAdmin } from "@/lib/auth";
import { getAdminUsageStats } from "@/lib/admin-usage-stats";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stats = await getAdminUsageStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[admin/usage GET]", err);
    return NextResponse.json({ error: "Failed to load usage stats" }, { status: 500 });
  }
}
