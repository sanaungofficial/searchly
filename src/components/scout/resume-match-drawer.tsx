"use client";

import { useEffect, useState } from "react";

interface MatchData {
  score: number;
  scoreLabel: string;
  jobTitle: string;
  resumeTitle: string;
  yoeRequired: string;
  yoeCandidate: string;
  yoeMatch: boolean;
  industries: string[];
  industryMatch: boolean;
  keywords: { text: string; matched: boolean }[];
  summaryNote: string;
}

interface ResumeMatchDrawerProps {
  jobTitle: string;
  company: string;
  description: string;
  onClose: () => void;
  onTailorResume: () => void;
}

function ScoreGauge({ score }: { score: number }) {
  const pct = score / 10;
  const color =
    score >= 8 ? "#4A8B6A" : score >= 6 ? "#C4A86A" : "#C4574A";
  const label =
    score >= 8 ? "Strong" : score >= 6 ? "Good" : score >= 4 ? "Fair" : "Poor";
  const r = 44;
  const circ = 2 * Math.PI * r;
  // Half-circle gauge: use the bottom half of the SVG
  const arcLen = circ * 0.5 * pct;
  const gap = circ * 0.5 - arcLen;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 100, height: 56, overflow: "hidden" }}>
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 0, left: 0, transform: "rotate(180deg)" }}
        >
          <circle cx="50" cy="50" r={r} stroke="rgba(0,0,0,0.08)" strokeWidth="10" fill="none"
            strokeDasharray={`${circ * 0.5} ${circ * 0.5}`} strokeDashoffset={0} strokeLinecap="round" />
          <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="10" fill="none"
            strokeDasharray={`${arcLen} ${circ - arcLen}`} strokeDashoffset={0} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{score.toFixed(1)}</span>
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color, letterSpacing: "0.5px" }}>{label}</span>
    </div>
  );
}

function Row({
  label,
  left,
  right,
  status,
}: {
  label: string;
  left: React.ReactNode;
  right: React.ReactNode;
  status: "ok" | "warn" | "neutral";
}) {
  const icon = status === "ok" ? "✓" : status === "warn" ? "!" : "–";
  const iconColor = status === "ok" ? "#4A8B6A" : status === "warn" ? "#C4A86A" : "#A09890";
  const iconBg = status === "ok" ? "rgba(74,139,106,0.1)" : status === "warn" ? "rgba(196,168,106,0.1)" : "rgba(0,0,0,0.05)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 28px 1fr 1fr", gap: 8, alignItems: "start", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 500, color: "#52493F" }}>{label}</span>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 700, color: iconColor, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A1A1A", lineHeight: 1.5 }}>{left}</span>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F", lineHeight: 1.5 }}>{right}</span>
    </div>
  );
}

export function ResumeMatchDrawer({ jobTitle, company, description, onClose, onTailorResume }: ResumeMatchDrawerProps) {
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [manualDesc, setManualDesc] = useState("");

  function generate(overrideDesc?: string) {
    setLoading(true);
    setError(null);
    setData(null);
    const desc = overrideDesc !== undefined ? overrideDesc : description;
    fetch("/api/ai/job-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle, company, description: desc }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Something went wrong"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTitle, company, description]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 200,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Centering wrapper */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 201,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          pointerEvents: "none",
        }}
      >
      {/* Modal */}
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          maxHeight: "85vh",
          background: "#FAF7F2",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: visible ? "scale(1)" : "scale(0.96)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.2s ease, opacity 0.2s ease",
          pointerEvents: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button
            onClick={handleClose}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#52493F", flexShrink: 0 }}
          >
            ×
          </button>
          <div>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>Resume Match</p>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890" }}>{jobTitle} · {company}</p>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>Analyzing your resume against this role…</p>
            </div>
          )}

          {error && (
            <div style={{ paddingTop: 20 }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#C4574A", marginBottom: error === "No job description provided" ? 14 : 0 }}>
                {error === "No resume found"
                  ? "Upload a resume in your profile to see your match."
                  : error === "No job description provided"
                  ? "This job doesn't have a description stored. Paste it below:"
                  : "Couldn't load match analysis. Try again."}
              </p>
              {error === "No job description provided" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <textarea
                    value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)}
                    placeholder="Paste the job description here…"
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 8,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      color: "#1A1A1A",
                      resize: "vertical",
                      background: "#FFFFFF",
                      lineHeight: 1.6,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => { if (manualDesc.trim()) generate(manualDesc.trim()); }}
                    disabled={!manualDesc.trim()}
                    style={{
                      padding: "11px",
                      background: manualDesc.trim() ? "#1A3A2F" : "rgba(0,0,0,0.05)",
                      color: manualDesc.trim() ? "#E8D5A3" : "#A09890",
                      border: "none",
                      borderRadius: 8,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: manualDesc.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Analyze My Resume →
                  </button>
                </div>
              )}
            </div>
          )}

          {data && (
            <>
              {/* Score */}
              <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "20px", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
                <ScoreGauge score={data.score} />
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>
                    Your resume is a {data.scoreLabel} match
                  </p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F", lineHeight: 1.55 }}>
                    {data.score < 6
                      ? "Key gaps detected — tailoring your resume will significantly improve your chances."
                      : data.score < 8
                      ? "Solid foundation. A few targeted tweaks could push you into strong match territory."
                      : "You're a strong candidate for this role."}
                  </p>
                </div>
              </div>

              {/* Comparison table */}
              <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 16, overflow: "hidden" }}>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "120px 28px 1fr 1fr", gap: 8, padding: "10px 16px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>Overview</span>
                  <span />
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>Job requires</span>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>Your resume</span>
                </div>

                <div style={{ padding: "0 16px" }}>
                  <Row
                    label="Job Title"
                    left={data.jobTitle}
                    right={data.resumeTitle}
                    status="neutral"
                  />
                  <Row
                    label="Experience"
                    left={data.yoeRequired}
                    right={data.yoeCandidate}
                    status={data.yoeMatch ? "ok" : "warn"}
                  />
                  <Row
                    label="Industry"
                    left={
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {data.industries.slice(0, 4).map((ind) => (
                          <span key={ind} style={{ padding: "2px 6px", background: "rgba(0,0,0,0.05)", borderRadius: 4, fontSize: 10 }}>{ind}</span>
                        ))}
                      </span>
                    }
                    right={data.industryMatch ? "Relevant experience" : "Limited overlap"}
                    status={data.industryMatch ? "ok" : "warn"}
                  />
                  <Row
                    label="Summary"
                    left={<span style={{ color: "#52493F", fontStyle: "italic" }}>{data.summaryNote}</span>}
                    right=""
                    status={data.score >= 7 ? "ok" : "warn"}
                  />
                </div>
              </div>

              {/* Keywords */}
              <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", padding: "16px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>
                    Keywords
                  </p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>
                    {data.keywords.filter((k) => k.matched).length}/{data.keywords.length} matched
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {data.keywords.map((kw) => (
                    <span
                      key={kw.text}
                      style={{
                        padding: "4px 9px",
                        borderRadius: 20,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        fontWeight: 500,
                        background: kw.matched ? "rgba(74,139,106,0.1)" : "rgba(196,87,74,0.07)",
                        color: kw.matched ? "#1C3A2F" : "#7A2A20",
                        border: `1px solid ${kw.matched ? "rgba(74,139,106,0.2)" : "rgba(196,87,74,0.15)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 10 }}>{kw.matched ? "✓" : "!"}</span>
                      {kw.text}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {data && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
            <button
              onClick={() => { handleClose(); onTailorResume(); }}
              style={{
                width: "100%",
                padding: "12px",
                background: "#1A3A2F",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 8,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.2px",
              }}
            >
              Tailor My Resume for This Role →
            </button>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
