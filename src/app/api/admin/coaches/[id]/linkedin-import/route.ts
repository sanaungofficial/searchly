import { requireAdmin } from "@/lib/auth";
import { applyLinkedInImportForCoach, buildCoachLinkedInImportPreview } from "@/lib/coach-linkedin-import-apply";
import {
  COACH_LINKEDIN_IMPORT_SECTIONS,
  type CoachLinkedInImportSection,
} from "@/lib/coach-linkedin-import-merge";
import { isApifyConfigured, scrapeLinkedInProfile, type ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function parseSections(raw: unknown): CoachLinkedInImportSection[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(COACH_LINKEDIN_IMPORT_SECTIONS);
  return raw.filter((s): s is CoachLinkedInImportSection => typeof s === "string" && allowed.has(s));
}

function parseScraped(raw: unknown): ApifyLinkedInProfile | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ApifyLinkedInProfile;
}

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

  const sections = parseSections(body.sections);
  const isApply = sections.length > 0 || body.apply === true;

  try {
    const scraped = parseScraped(body.scraped) ?? (await scrapeLinkedInProfile(linkedinUrl, { userId: coach.userId ?? coach.id }));

    if (!isApply) {
      const preview = buildCoachLinkedInImportPreview({ coach, linkedinUrl, scraped });
      return NextResponse.json({
        ok: true,
        preview: true,
        coach,
        diffs: preview.diffs,
        proposed: preview.proposed,
        scraped,
        linkedinUrl,
      });
    }

    const applySections =
      sections.length > 0 ? sections : ([...COACH_LINKEDIN_IMPORT_SECTIONS] as CoachLinkedInImportSection[]);

    const result = await applyLinkedInImportForCoach({
      coach,
      linkedinUrl,
      scraped,
      sections: applySections,
    });

    return NextResponse.json({
      ok: true,
      coach: result.coach,
      appliedFields: result.appliedFields,
      linkedinUrl,
      message:
        result.appliedFields.length > 0
          ? `Applied ${result.appliedFields.length} field${result.appliedFields.length === 1 ? "" : "s"} from LinkedIn.`
          : "No changes applied — selected sections matched existing data or were empty.",
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
