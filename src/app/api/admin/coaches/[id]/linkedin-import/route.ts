import { requireAdmin } from "@/lib/auth";
import { applyLinkedInImportForCoach } from "@/lib/coach-linkedin-import-apply";
import { isApifyConfigured, scrapeLinkedInProfile } from "@/lib/apify-linkedin";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isApifyConfigured()) {
    return NextResponse.json({ error: "LinkedIn import is not configured on this environment." }, { status: 503 });
  }

  const { id } = await params;
  const coach = await prisma.coachProfile.findUnique({ where: { id } });
  if (!coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const linkedinUrl =
    normalizeLinkedInUrl(typeof body.linkedinUrl === "string" ? body.linkedinUrl : "") ||
    normalizeLinkedInUrl(coach.linkedinUrl ?? "");

  if (!linkedinUrl) {
    return NextResponse.json({ error: "A valid LinkedIn profile URL is required." }, { status: 400 });
  }

  try {
    const scraped = await scrapeLinkedInProfile(linkedinUrl, { userId: coach.userId ?? coach.id });
    const result = await applyLinkedInImportForCoach({
      coach,
      linkedinUrl,
      scraped,
    });

    return NextResponse.json({
      ok: true,
      coach: result.coach,
      filledFields: result.filledFields,
      linkedinUrl,
      message:
        result.filledFields.length > 0
          ? `Filled ${result.filledFields.length} field${result.filledFields.length === 1 ? "" : "s"} from LinkedIn.`
          : "No empty fields to fill — existing coach data was kept.",
    });
  } catch (err) {
    console.error("[admin/coaches/linkedin-import]", err);
    let message = err instanceof Error ? err.message : "LinkedIn import failed.";
    if (message.startsWith("LINKEDIN_EMPTY:")) {
      message = message.slice("LINKEDIN_EMPTY:".length);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
