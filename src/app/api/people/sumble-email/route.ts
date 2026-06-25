import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { fetchSumblePersonByLinkedIn, isSumbleConfigured } from "@/lib/sumble";
import {
  assertSumbleCreditsAvailable,
  getSumbleCreditsRemaining,
  SUMBLE_ESTIMATED_COSTS,
  SumbleInsufficientCreditsError,
} from "@/lib/sumble-credits";

/** Reveal work email for a LinkedIn profile via Sumble (10 credits first reveal). */
export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSumbleConfigured()) {
    return NextResponse.json({ error: "Sumble is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    linkedinUrl?: string;
    load?: boolean;
  } | null;

  if (body?.load !== true) {
    return NextResponse.json(
      {
        requiresLoad: true,
        estimatedCredits: SUMBLE_ESTIMATED_COSTS.emailReveal,
        creditsRemaining: getSumbleCreditsRemaining(),
      },
      { status: 400 }
    );
  }

  const linkedinUrl = body.linkedinUrl?.trim() ?? "";
  if (!linkedinUrl || !linkedinUrl.includes("linkedin.com/in/")) {
    return NextResponse.json({ error: "Valid LinkedIn profile URL required." }, { status: 400 });
  }

  try {
    assertSumbleCreditsAvailable(SUMBLE_ESTIMATED_COSTS.emailReveal);
    const result = await fetchSumblePersonByLinkedIn({ linkedinUrl, revealEmail: true });

    return NextResponse.json({
      person: result.person,
      email: result.email,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      error: result.person && !result.email ? "No work email found for this profile." : undefined,
    });
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Email reveal failed.";
    return NextResponse.json(
      {
        error: message,
        creditsRemaining:
          err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : getSumbleCreditsRemaining(),
      },
      { status: 502 }
    );
  }
}
