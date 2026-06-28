"use client";

const BENEFITS = [
  "AI-powered resume tailored for every application",
  "Job matches across tech, strategy, and operations",
  "Interview prep and offer negotiation guidance",
  "Career pivot support for any industry transition",
];

const COMPANIES = [
  "McKinsey", "BCG", "Bain",
  "Deloitte", "PwC", "EY",
  "Google", "Amazon", "Microsoft",
];

export function AuthPageBenefits() {
  return (
    <div
      style={{
        background: "#1A3A2F",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "clamp(40px, 6vw, 80px) clamp(36px, 5vw, 64px)",
        color: "#fff",
        minHeight: "100%",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 3vw, 40px)",
          fontWeight: 500,
          color: "#F2EDE3",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          fontStyle: "italic",
          margin: "0 0 36px",
        }}
      >
        Land the role you&rsquo;ve<br />been building toward.
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
        {BENEFITS.map((b) => (
          <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span
              style={{
                color: "#E8D5A3",
                fontSize: 15,
                lineHeight: 1.55,
                flexShrink: 0,
                marginTop: 1,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 15,
                color: "rgba(242,237,227,0.88)",
                lineHeight: 1.55,
              }}
            >
              {b}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(232,213,163,0.2)", paddingTop: 28 }}>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(232,213,163,0.55)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 16px",
          }}
        >
          Our members come from
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px" }}>
          {COMPANIES.map((c) => (
            <span
              key={c}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(242,237,227,0.65)",
                padding: "4px 10px",
                border: "1px solid rgba(232,213,163,0.18)",
                borderRadius: 6,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
