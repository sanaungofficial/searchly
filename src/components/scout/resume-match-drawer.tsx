"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type Step = 1 | 2 | 3;

const STEPS = [
  { n: 1 as Step, label: "See Your Difference" },
  { n: 2 as Step, label: "Align Your Resume" },
  { n: 3 as Step, label: "Review Your New Resume" },
];

function Stepper({ step }: { step: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "20px 32px 16px" }}>
      {STEPS.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: step > s.n ? "#1A3A2F" : step === s.n ? "#1A3A2F" : "rgba(0,0,0,0.07)",
                color: step >= s.n ? "#E8D5A3" : "#A09890",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: step > s.n ? 13 : 12,
                fontWeight: 700,
                fontFamily: "var(--font-dm-sans), system-ui",
                flexShrink: 0,
              }}
            >
              {step > s.n ? "✓" : s.n}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: step === s.n ? 600 : 400,
                color: step === s.n ? "#1A1A1A" : "#A09890",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-dm-sans), system-ui",
                textAlign: "center",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 1,
                background: step > s.n ? "#1A3A2F" : "rgba(0,0,0,0.1)",
                margin: "0 10px",
                marginBottom: 22,
                flexShrink: 1,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function BigScoreGauge({ score }: { score: number }) {
  const color =
    score >= 8 ? "#4A8B6A" : score >= 6 ? "#C4A86A" : score >= 4 ? "#C4574A" : "#9B3A2A";
  const label =
    score >= 8 ? "Strong" : score >= 6 ? "Good" : score >= 4 ? "Fair" : "Poor";
  const r = 58;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 10, 1);
  const arcLen = circ * 0.5 * pct;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ position: "relative", width: 130, height: 72, overflow: "hidden" }}>
        <svg
          width="130"
          height="130"
          viewBox="0 0 130 130"
          style={{ position: "absolute", top: 0, left: 0, transform: "rotate(180deg)" }}
        >
          <circle
            cx="65" cy="65" r={r}
            stroke="rgba(0,0,0,0.07)" strokeWidth="12" fill="none"
            strokeDasharray={`${circ * 0.5} ${circ * 0.5}`}
            strokeLinecap="round"
          />
          <circle
            cx="65" cy="65" r={r}
            stroke={color} strokeWidth="12" fill="none"
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color, letterSpacing: "0.5px" }}>
        {label}
      </span>
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
  const iconColor =
    status === "ok" ? "#4A8B6A" : status === "warn" ? "#C4A86A" : "#A09890";
  const iconBg =
    status === "ok"
      ? "rgba(74,139,106,0.12)"
      : status === "warn"
      ? "rgba(196,168,106,0.12)"
      : "rgba(0,0,0,0.05)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 28px 1fr 1fr",
        gap: 12,
        alignItems: "start",
        padding: "12px 0",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#52493F" }}>
        {label}
      </span>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 10,
          fontWeight: 700,
          color: iconColor,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {icon}
      </span>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#1A1A1A", lineHeight: 1.55 }}>
        {left}
      </span>
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#52493F", lineHeight: 1.55 }}>
        {right}
      </span>
    </div>
  );
}

export function ResumeMatchDrawer({
  jobTitle,
  company,
  description,
  onClose,
  onTailorResume,
}: ResumeMatchDrawerProps) {
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [aligning, setAligning] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [mounted, setMounted] = useState(false);
  const kwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

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
    setTimeout(onClose, 280);
  }

  function handleAlign() {
    setStep(2);
    setAligning(true);
    // Brief transition then open the editor
    setTimeout(() => {
      setStep(3);
      setAligning(false);
    }, 1800);
  }

  function handleOpenEditor() {
    handleClose();
    setTimeout(onTailorResume, 280);
  }

  const scoreColor =
    data && data.score >= 8
      ? "#4A8B6A"
      : data && data.score >= 6
      ? "#C4A86A"
      : "#C4574A";

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 200,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(860px, 78vw)",
          background: "#FFFFFF",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.32, 0, 0.16, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 14,
                fontWeight: 700,
                color: "#E8D5A3",
                flexShrink: 0,
              }}
            >
              {company.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                {company}
              </p>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>
                {jobTitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid rgba(0,0,0,0.1)",
              background: "rgba(0,0,0,0.03)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: "#52493F",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Stepper */}
        <div style={{ borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
          <Stepper step={step} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>
                    Analyzing your resume against this role…
                  </p>
                </div>
              )}

              {error && (
                <div style={{ paddingTop: 20 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#C4574A", marginBottom: error === "No job description provided" ? 14 : 0 }}>
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
                          fontSize: 13,
                          color: "#1A1A1A",
                          resize: "vertical",
                          background: "#FAFAFA",
                          lineHeight: 1.6,
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => { if (manualDesc.trim()) generate(manualDesc.trim()); }}
                        disabled={!manualDesc.trim()}
                        style={{
                          padding: "12px",
                          background: manualDesc.trim() ? "#1A3A2F" : "rgba(0,0,0,0.05)",
                          color: manualDesc.trim() ? "#E8D5A3" : "#A09890",
                          border: "none",
                          borderRadius: 8,
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 13,
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
                  {/* Score hero */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 20,
                      padding: "24px 28px",
                      background: "#FAF7F2",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#1A1A1A",
                          marginBottom: 8,
                          lineHeight: 1.3,
                        }}
                      >
                        Your Resume is a{" "}
                        <span style={{ color: scoreColor }}>{data.scoreLabel}</span> Match
                      </p>
                      {data.score < 6 && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            background: "rgba(196,87,74,0.08)",
                            borderRadius: 6,
                            border: "1px solid rgba(196,87,74,0.15)",
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#C4574A", fontFamily: "var(--font-dm-sans), system-ui" }}>ⓘ</span>
                          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#C4574A" }}>
                            Resumes under 6.0 are likely to be filtered out — we&apos;ll help you fix it fast.
                          </p>
                        </div>
                      )}
                      {data.score >= 6 && data.score < 8 && (
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", lineHeight: 1.55 }}>
                          Solid foundation. A few targeted tweaks could push you into strong match territory.
                        </p>
                      )}
                      {data.score >= 8 && (
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", lineHeight: 1.55 }}>
                          You&apos;re a strong candidate for this role.
                        </p>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: 24 }}>
                      <BigScoreGauge score={data.score} />
                    </div>
                  </div>

                  {/* Comparison table */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.07)",
                      marginBottom: 20,
                      overflow: "hidden",
                    }}
                  >
                    {/* Column headers */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 28px 1fr 1fr",
                        gap: 12,
                        padding: "10px 16px",
                        background: "rgba(0,0,0,0.02)",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>Overview</span>
                      <span />
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>Job Requires</span>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>Your Resume</span>
                    </div>
                    <div style={{ padding: "0 16px" }}>
                      <Row label="Job Title" left={data.jobTitle} right={data.resumeTitle} status="neutral" />
                      <Row label="Experience" left={data.yoeRequired} right={data.yoeCandidate} status={data.yoeMatch ? "ok" : "warn"} />
                      <Row
                        label="Industry Experience"
                        left={
                          <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {data.industries.slice(0, 4).map((ind) => (
                              <span key={ind} style={{ padding: "2px 7px", background: "rgba(0,0,0,0.05)", borderRadius: 4, fontSize: 11 }}>{ind}</span>
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
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.07)",
                      padding: "16px",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Job Keywords
                      </p>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890" }}>
                        {data.keywords.filter((k) => k.matched).length}/{data.keywords.length + customKeywords.length} matched
                      </p>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.keywords.map((kw) => (
                        <span
                          key={kw.text}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 20,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 12,
                            fontWeight: 500,
                            background: kw.matched ? "rgba(74,139,106,0.08)" : "rgba(196,87,74,0.06)",
                            color: kw.matched ? "#1C3A2F" : "#7A2A20",
                            border: `1px solid ${kw.matched ? "rgba(74,139,106,0.18)" : "rgba(196,87,74,0.14)"}`,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 10 }}>{kw.matched ? "✓" : "!"}</span>
                          {kw.text}
                        </span>
                      ))}
                      {customKeywords.map((kw) => (
                        <span
                          key={`custom-${kw}`}
                          style={{
                            padding: "5px 7px 5px 10px",
                            borderRadius: 20,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 12,
                            fontWeight: 500,
                            background: "rgba(196,87,74,0.06)",
                            color: "#7A2A20",
                            border: "1px dashed rgba(196,87,74,0.3)",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 10 }}>+</span>
                          {kw}
                          <button
                            type="button"
                            onClick={() => setCustomKeywords((prev) => prev.filter((k) => k !== kw))}
                            style={{ background: "none", border: "none", padding: "0 1px", cursor: "pointer", color: "#C4574A", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center" }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <input
                          ref={kwInputRef}
                          value={newKw}
                          onChange={(e) => setNewKw(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              const val = newKw.trim().replace(/,$/, "");
                              if (val && !data.keywords.some((k) => k.text.toLowerCase() === val.toLowerCase()) && !customKeywords.includes(val)) {
                                setCustomKeywords((prev) => [...prev, val]);
                              }
                              setNewKw("");
                            }
                            if (e.key === "Escape") setNewKw("");
                          }}
                          placeholder="+ Add keyword"
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            color: "#52493F",
                            background: "transparent",
                            border: "1px dashed rgba(0,0,0,0.18)",
                            borderRadius: 20,
                            padding: "5px 12px",
                            outline: "none",
                            width: newKw ? `${Math.max(100, newKw.length * 8 + 24)}px` : 110,
                            transition: "width 0.15s ease, border-color 0.15s ease",
                            cursor: "text",
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(74,139,106,0.5)"; }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "rgba(0,0,0,0.18)";
                            const val = newKw.trim();
                            if (val && !data.keywords.some((k) => k.text.toLowerCase() === val.toLowerCase()) && !customKeywords.includes(val)) {
                              setCustomKeywords((prev) => [...prev, val]);
                            }
                            setNewKw("");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24, paddingTop: 60 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "3px solid rgba(26,58,47,0.12)",
                  borderTopColor: "#1A3A2F",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>
                  Aligning Your Resume
                </p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>
                  Tailoring your resume to match this role&apos;s requirements…
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20, paddingTop: 60 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(74,139,106,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#4A8B6A",
                }}
              >
                ✓
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 18, fontWeight: 700, color: "#1A1A1A", marginBottom: 8 }}>
                  Your Resume is Ready
                </p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", lineHeight: 1.6 }}>
                  We&apos;ve tailored your resume for <strong>{jobTitle}</strong> at <strong>{company}</strong>.
                  <br />Open the editor to review, edit, and download.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenEditor}
                style={{
                  marginTop: 8,
                  padding: "14px 32px",
                  background: "#1A3A2F",
                  color: "#E8D5A3",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                }}
              >
                Review Your New Resume →
              </button>
            </div>
          )}
        </div>

        {/* Footer CTA — only on step 1 when data is loaded */}
        {step === 1 && data && (
          <div
            style={{
              padding: "16px 32px",
              borderTop: "1px solid rgba(0,0,0,0.07)",
              flexShrink: 0,
              background: "#FFFFFF",
            }}
          >
            <button
              type="button"
              onClick={handleAlign}
              style={{
                width: "100%",
                padding: "15px",
                background: "#1A3A2F",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 10,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.3px",
              }}
            >
              Align My Resume for This Role →
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
