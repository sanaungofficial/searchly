"use client";

type Props = { onClose: () => void };

export function GrowthWelcomeModal({ onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }}
      />
      <div
        role="dialog"
        style={{
          position: "relative",
          background: "#1A3A2F",
          borderRadius: 14,
          padding: "40px 36px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            fontStyle: "italic",
            color: "#E8D5A3",
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          You&apos;re on Pro.
        </p>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 15,
            color: "rgba(232,213,163,0.75)",
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          Unlimited AI tools, fit analysis, and cover letters — no more counting runs. Open any job and try a full tailor pass.
        </p>
        <button
          onClick={onClose}
          style={{
            padding: "12px 28px",
            background: "#E8D5A3",
            color: "#1A3A2F",
            border: "none",
            borderRadius: 8,
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Let&apos;s go →
        </button>
      </div>
    </div>
  );
}
