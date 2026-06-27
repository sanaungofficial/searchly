import { NextResponse } from "next/server";
import { provisionClient } from "@/lib/admin-client-provision";
import { findLiveSessionByRouteId, registerForLiveSession } from "@/lib/live-session-db";
import { sendLiveSessionRegistrationEmail } from "@/lib/live-session-emails";
import { logLiveSessionEvent } from "@/lib/live-session-events";
import { parseLiveSessionRouteId } from "@/lib/live-sessions";

/** Register for a webinar without an existing account — creates user + sends invite. */
export async function POST(request: Request) {
  let body: { sessionId?: string; email?: string; name?: string };
  try {
    body = (await request.json()) as { sessionId?: string; email?: string; name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const routeId = parseLiveSessionRouteId(body.sessionId?.trim() ?? "");
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;

  if (!routeId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const row = await findLiveSessionByRouteId(routeId);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (row.status !== "SCHEDULED" && row.status !== "LIVE") {
    return NextResponse.json({ error: "Registration is closed for this session" }, { status: 410 });
  }

  try {
    const { user, invited } = await provisionClient({
      email,
      name,
      sendInvite: true,
      markOnboardingComplete: false,
    });

    const { created } = await registerForLiveSession(row.id, user.id);

    if (created) {
      await logLiveSessionEvent({
        liveSessionId: row.id,
        userId: user.id,
        type: "REGISTERED",
      });
    }

    if (created) {
      void sendLiveSessionRegistrationEmail({
        email,
        name: user.name,
        session: {
          title: row.title,
          host: row.hostName,
          scheduledStart: row.scheduledStart,
          scheduledEnd: row.scheduledEnd,
          legacyNumericId: row.legacyNumericId,
          id: row.id,
        },
      }).catch((err) => console.error("[live/register-guest email]", err));
    }

    return NextResponse.json({
      ok: true,
      registered: true,
      created,
      invited,
      message: invited
        ? "You're registered. Check your email to sign in before the live session."
        : "You're registered. Sign in with your existing Kimchi account before the session.",
    });
  } catch (err) {
    console.error("[live/register-guest]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not complete registration" },
      { status: 400 },
    );
  }
}
