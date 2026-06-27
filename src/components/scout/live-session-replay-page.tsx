import Link from "next/link";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { color, fontSans, border as B } from "@/lib/typography";

export function LiveSessionReplayPage({
  session,
  replayUrl,
}: {
  session: LiveSessionView;
  replayUrl: string | null;
}) {
  const routeId = liveSessionRouteId(session);
  const bookHref = session.coachSlug
    ? `/coach/${session.coachSlug}`
    : "/coaching";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 48px" }}>
      <div
        style={{
          background: session.bgColor,
          border: B.lineStrong,
          padding: "24px 22px",
          marginBottom: 24,
          color: session.accentColor,
        }}
      >
        <p
          style={{
            fontFamily: fontSans,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: "0 0 10px",
            opacity: 0.85,
          }}
        >
          Session replay
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 500,
            fontStyle: "italic",
            color: "#fff",
            margin: "0 0 10px",
            lineHeight: 1.2,
          }}
        >
          {session.title}
        </h1>
        <p style={{ fontFamily: fontSans, fontSize: 14, opacity: 0.85, margin: 0 }}>
          with {session.host} · {session.date}
        </p>
      </div>

      {replayUrl ? (
        <div style={{ marginBottom: 24, border: B.lineStrong, background: "#000" }}>
          <video
            controls
            playsInline
            src={replayUrl}
            style={{ width: "100%", display: "block", maxHeight: "70vh" }}
          />
        </div>
      ) : (
        <div
          style={{
            padding: "32px 24px",
            background: "rgba(26,58,47,0.06)",
            border: B.line,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: 15, color: color.stone, margin: 0, lineHeight: 1.6 }}>
            The replay is still processing. Check back soon — we&apos;ll email you when it&apos;s ready.
          </p>
        </div>
      )}

      <p
        style={{
          fontFamily: fontSans,
          fontSize: 15,
          color: color.stone,
          lineHeight: 1.65,
          marginBottom: 24,
        }}
      >
        {session.description}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <Link
          href={bookHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            padding: "12px 20px",
            background: color.forest,
            color: color.gold,
            border: B.lineStrong,
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Book time with {session.host} →
        </Link>
        <Link
          href={`/live/${routeId}`}
          style={{
            fontFamily: fontSans,
            fontSize: 14,
            color: color.forest,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          ← Back to session page
        </Link>
      </div>
    </div>
  );
}
