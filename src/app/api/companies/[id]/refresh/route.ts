import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { mergeTrackedWithIntel } from "@/lib/company-intel";
import { scanTrackedCompanyMatches } from "@/lib/company-jobs-scan";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await prisma.trackedCompany.findFirst({
    where: { id, userId: dbUser.id },
    include: { companyIntel: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await scanTrackedCompanyMatches(id, dbUser.id);
  if (!result.ok) {
    const status =
      result.error.includes("not configured")
        ? 503
        : result.error.includes("Upload a resume") || result.error.includes("upload your resume")
          ? 422
          : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  const merged = mergeTrackedWithIntel(result.company, company.companyIntel);
  return NextResponse.json(merged);
}
