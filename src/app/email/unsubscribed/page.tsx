import Link from "next/link";

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
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F2EDE3",
        fontFamily: "var(--font-ui, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: "#FFFDF9",
          border: "1px solid #E5DDD0",
          borderRadius: "var(--scout-radius)",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        {ok ? (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 500, color: "#1C3A2F" }}>
              You&apos;re unsubscribed
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 15, color: "#52493F", lineHeight: 1.6 }}>
              You won&apos;t receive daily job match emails from Kimchi anymore. You can turn them back on anytime in
              Account settings.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 500, color: "#1C3A2F" }}>
              Link expired or invalid
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 15, color: "#52493F", lineHeight: 1.6 }}>
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
            background: "#1C3A2F",
            color: "#F2EDE3",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: "var(--scout-radius)",
          }}
        >
          Back to Kimchi
        </Link>
      </div>
    </main>
  );
}
