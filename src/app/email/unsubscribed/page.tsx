import Link from "next/link";
import { bruddleHeadingStyle, color, fontSans, surface } from "@/lib/typography";

export default async function DigestUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const ok = sp.ok === "1";
  const error = sp.error;

  return (
    <main
      className="bruddle"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: surface.page,
        fontFamily: fontSans,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: surface.card,
          border: "var(--scout-border)",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        {ok ? (
          <>
            <h1 style={{ ...bruddleHeadingStyle("h5"), margin: "0 0 8px", color: color.forest }}>
              You&apos;re unsubscribed
            </h1>
            <p style={{ margin: "0 0 24px", fontSize: 16, color: color.stone, lineHeight: 1.6 }}>
              You won&apos;t receive daily job match emails from Kimchi anymore. You can turn them back on anytime in
              Account settings.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ ...bruddleHeadingStyle("h5"), margin: "0 0 8px", color: color.forest }}>
              Link expired or invalid
            </h1>
            <p style={{ margin: "0 0 24px", fontSize: 16, color: color.stone, lineHeight: 1.6 }}>
              {error === "missing"
                ? "This unsubscribe link is missing a token."
                : "This unsubscribe link is invalid or has expired. Manage email preferences in your account settings instead."}
            </p>
          </>
        )}
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "var(--scout-cta)",
            color: "var(--scout-cta-foreground)",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            border: "var(--scout-border)",
            boxShadow: "var(--scout-shadow-bruddle)",
          }}
        >
          Back to Kimchi
        </Link>
      </div>
    </main>
  );
}
