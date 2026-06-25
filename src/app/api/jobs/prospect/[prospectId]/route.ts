import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchHirebaseJobById } from "@/lib/hirebase";
import { decodeProspectPathId } from "@/lib/workspace-urls";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prospectId } = await params;
  const decoded = decodeProspectPathId(decodeURIComponent(prospectId));

  if (decoded.url) {
    return NextResponse.json({
      job: {
        title: "Saved job link",
        url: decoded.url,
      },
      companyName: null,
    });
  }

  if (!decoded.hirebaseId) {
    return NextResponse.json({ error: "Invalid prospect id" }, { status: 400 });
  }

  try {
    const result = await fetchHirebaseJobById(decoded.hirebaseId);
    if (!result) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job: result.job, companyName: result.companyName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load job";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
