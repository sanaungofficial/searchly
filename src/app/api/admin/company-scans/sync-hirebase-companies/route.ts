import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { syncTop50HirebaseCompanies } from "@/lib/hirebase-company-sync";

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isHirebaseConfigured()) {
    return NextResponse.json(
      { error: "Set HIREBASE_API_KEY on the server before syncing company profiles." },
      { status: 503 }
    );
  }

  const summary = await syncTop50HirebaseCompanies();
  return NextResponse.json(summary);
}
