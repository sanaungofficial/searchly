"use client";

/* ──────────────────────────────────────────────────────────────
   Direction Comparison — Beat 3 (The Read-Back) shown three ways
   ────────────────────────────────────────────────────────────── */

function HeaderRow({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 10,
          fontWeight: 600,
          color: "#8A8278",
          letterSpacing: "1px",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 12,
          fontWeight: 300,
          color: "#8A8278",
        }}
      >
        {sub}
      </p>
    </div>
  );
}

/* A — The Correspondent (primary direction) */
function CorrespondentCard() {
  return (
    <div style={{ flex: "none", width: 390 }}>
      <HeaderRow label="A — The Correspondent" sub="Playfair serif · editorial · generous white space" />
      <div
        style={{
          background: "#F0EEE9",
          borderRadius: 10,
          padding: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Scout&apos;s read
        </p>
        <h3
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 25,
            fontWeight: 400,
            fontStyle: "italic",
            color: "#1A1A1A",
            marginBottom: 22,
            lineHeight: 1.2,
          }}
        >
          Here&apos;s what I see.
        </h3>
        <div
          style={{
            background: "white",
            borderRadius: 8,
            padding: 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 16,
              borderBottom: "1px solid #EEE9E2",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#E8D5A3",
                }}
              >
                SC
              </span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#1A1A1A",
                  marginBottom: 2,
                }}
              >
                Senior IC → Director-ready
              </p>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 10,
                  fontWeight: 300,
                  color: "#A09890",
                }}
              >
                8 years · SaaS Product
              </p>
            </div>
          </div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 9,
              fontWeight: 500,
              color: "#A09890",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              marginBottom: 9,
            }}
          >
            Strengths
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {["Product Strategy", "Cross-functional", "Data Analysis"].map((s) => (
              <span
                key={s}
                style={{
                  padding: "5px 12px",
                  background: "#F5F3EF",
                  borderRadius: 100,
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 11,
                  color: "#2A2218",
                }}
              >
                {s}
              </span>
            ))}
          </div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 9,
              fontWeight: 500,
              color: "#A09890",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              marginBottom: 9,
            }}
          >
            Target Roles
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { role: "Head of Product", fit: "Strong" },
              { role: "Director of PM", fit: "Strong" },
            ].map((r) => (
              <div key={r.role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "#1A1A1A" }}>
                  {r.role}
                </span>
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "#4A8B6A" }}>
                  {r.fit}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #EEE9E2" }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: 9,
                fontWeight: 500,
                color: "#A09890",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Worth Noting
            </p>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#C4A86A",
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 11,
                  fontWeight: 300,
                  color: "#52493F",
                  lineHeight: 1.5,
                }}
              >
                Limited direct reports history — org leadership roles may need framing.
              </p>
            </div>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 13,
            fontWeight: 300,
            color: "#52493F",
            marginTop: 18,
            lineHeight: 1.5,
          }}
        >
          Does this feel accurate?
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            style={{
              padding: "10px 20px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 4,
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Looks right →
          </button>
          <button
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: "#52493F",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 4,
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Adjust
          </button>
        </div>
      </div>
    </div>
  );
}

/* B — The Analyst */
function AnalystCard() {
  const skillBars = [
    { label: "Strategy", pct: 92 },
    { label: "Leadership", pct: 74 },
    { label: "Analytics", pct: 86 },
  ];
  return (
    <div style={{ flex: "none", width: 390 }}>
      <HeaderRow label="B — The Analyst" sub="DM Sans + DM Mono · data-forward · structured grid" />
      <div
        style={{
          background: "#ECEAE4",
          borderRadius: 10,
          padding: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A3A2F" }} />
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 10,
              fontWeight: 500,
              color: "#1A3A2F",
              letterSpacing: "0.4px",
            }}
          >
            analysis complete
          </p>
        </div>
        <h3
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 22,
            fontWeight: 400,
            color: "#1A1A1A",
            letterSpacing: "-0.3px",
            marginBottom: 22,
            lineHeight: 1.2,
          }}
        >
          Here&apos;s what I see.
        </h3>
        <div
          style={{
            background: "white",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}
        >
          <div
            style={{
              background: "#1A3A2F",
              padding: "11px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 9,
                fontWeight: 500,
                color: "#E8D5A3",
                letterSpacing: "0.7px",
                textTransform: "uppercase",
              }}
            >
              Profile
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 9,
                color: "rgba(232,213,163,0.6)",
              }}
            >
              Senior IC
            </span>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                paddingBottom: 16,
                borderBottom: "1px solid #EEE9E2",
                marginBottom: 14,
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: 8,
                    color: "#A09890",
                    letterSpacing: "0.9px",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Experience
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    letterSpacing: "-0.5px",
                  }}
                >
                  8 yrs
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: 8,
                    color: "#A09890",
                    letterSpacing: "0.9px",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Match score
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#1A3A2F",
                    letterSpacing: "-0.5px",
                  }}
                >
                  91%
                </p>
              </div>
            </div>
            <p
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 8,
                color: "#A09890",
                letterSpacing: "0.9px",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Skill Signals
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {skillBars.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: 11,
                      color: "#3A3020",
                      width: 80,
                      flexShrink: 0,
                    }}
                  >
                    {s.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      background: "#EDE9E1",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${s.pct}%`,
                        height: "100%",
                        background: "#1A3A2F",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: 9,
                      color: "#A09890",
                      width: 26,
                      textAlign: "right",
                    }}
                  >
                    {s.pct}%
                  </span>
                </div>
              ))}
            </div>
            <p
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 8,
                color: "#A09890",
                letterSpacing: "0.9px",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Role Fit
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { role: "Head of Product", pct: "91%" },
                { role: "Director of PM", pct: "87%" },
              ].map((r) => (
                <div key={r.role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "#1A1A1A" }}>
                    {r.role}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#4A8B6A",
                    }}
                  >
                    {r.pct}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            style={{
              flex: 1,
              padding: 10,
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 3,
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Confirm →
          </button>
          <button
            style={{
              padding: "10px 14px",
              background: "transparent",
              color: "#52493F",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 3,
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/* C — The Mentor */
function MentorCard() {
  return (
    <div style={{ flex: "none", width: 390 }}>
      <HeaderRow label="C — The Mentor" sub="Cormorant Garamond · warm prose · dossier feel" />
      <div
        style={{
          background: "#F2EDE2",
          borderRadius: 10,
          padding: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 27,
            fontWeight: 500,
            color: "#1A1A1A",
            lineHeight: 1.2,
            marginBottom: 20,
          }}
        >
          Here&apos;s what I see.
        </h3>
        <div
          style={{
            background: "white",
            borderRadius: 6,
            padding: "24px 28px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-cormorant), serif",
              fontSize: 10,
              fontWeight: 500,
              color: "#A09890",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            A picture of you
          </p>
          <p
            style={{
              fontFamily: "var(--font-cormorant), serif",
              fontSize: 16,
              color: "#2A2218",
              lineHeight: 1.75,
              marginBottom: 22,
              textWrap: "pretty",
            }}
          >
            You&apos;re a seasoned Senior PM with eight years in the industry — data-literate,
            naturally cross-functional, and clearly ready for something bigger.
          </p>
          <div style={{ borderLeft: "2px solid #C4A86A", paddingLeft: 16, marginBottom: 20 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: 9,
                fontWeight: 500,
                color: "#A09890",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginBottom: 9,
              }}
            >
              You&apos;d thrive as
            </p>
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 15,
                fontWeight: 500,
                color: "#1A1A1A",
                lineHeight: 1.75,
              }}
            >
              Head of Product
              <br />
              Director of PM
              <br />
              Group Product Manager
            </p>
          </div>
          <div style={{ padding: "14px 16px", background: "#FBF8F2", borderRadius: 5 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: 9,
                fontWeight: 500,
                color: "#A09890",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginBottom: 7,
              }}
            >
              One honest note
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: 12,
                fontWeight: 300,
                color: "#6B6258",
                lineHeight: 1.55,
                textWrap: "pretty",
              }}
            >
              Your direct reports story is thin. Roles managing large orgs will need more framing
              to land well.
            </p>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-cormorant), serif",
            fontSize: 16,
            fontStyle: "italic",
            color: "#52493F",
            marginTop: 18,
            lineHeight: 1.5,
          }}
        >
          Does this feel like you?
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            style={{
              padding: "10px 20px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 4,
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Yes, carry on
          </button>
          <button
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: "#52493F",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 4,
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Refine this
          </button>
        </div>
      </div>
    </div>
  );
}

export function DirectionComparison() {
  return (
    <section style={{ background: "#E3E0D9", padding: "96px 60px 110px" }}>
      <div style={{ maxWidth: 1380, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ marginBottom: 60, maxWidth: 560 }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              fontWeight: 500,
              color: "#8A8278",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Visual direction exploration
          </p>
          <h3
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: 30,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#1A1A1A",
              letterSpacing: "-0.5px",
              marginBottom: 10,
            }}
          >
            Beat 3 — The Read-Back
          </h3>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 14,
              fontWeight: 300,
              color: "#6B6258",
              lineHeight: 1.65,
            }}
          >
            Three approaches to the moment that sells Scout. The interactive flow above uses
            Direction A.
          </p>
        </div>

        {/* Three frames */}
        <div
          style={{
            display: "flex",
            gap: 28,
            alignItems: "flex-start",
            overflowX: "auto",
            paddingBottom: 8,
          }}
        >
          <CorrespondentCard />
          <AnalystCard />
          <MentorCard />
        </div>
      </div>
    </section>
  );
}
