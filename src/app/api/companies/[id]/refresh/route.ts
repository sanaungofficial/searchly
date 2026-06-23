import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { getEffectiveCareersUrl, mergeTrackedWithIntel, syncTrackedFromIntel } from "@/lib/company-intel";
import { scanCompanyIntel } from "@/lib/company-jobs-scan";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await prisma.trackedCompany.findFirst({
    where: { id, userId: dbUser.id },
    include: { companyIntel: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const careersUrl = getEffectiveCareersUrl(company, company.companyIntel);
  if (!careersUrl) {
    return NextResponse.json({ error: "Add a Careers URL or website to scan for jobs." }, { status: 422 });
  }

  const intelId = company.companyIntelId;
  if (!intelId) {
    return NextResponse.json({ error: "Link this company to shared intel before scanning." }, { status: 422 });
  }

  const result = await scanCompanyIntel(intelId);
  if (!result.ok) {
    const status = result.error.includes("not configured") ? 503 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  const synced = await syncTrackedFromIntel(id, result.intel);
  return NextResponse.json(mergeTrackedWithIntel(synced, result.intel));
}
