"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface MatchData {
  score: number;
  scoreLabel: string;
  jobTitle: string;
  resumeTitle: string;
  jobTitleMatch?: boolean;
  yoeRequired: string;
  yoeCandidate: string;
  yoeMatch: boolean;
  industries: string[];
  industryMatch: boolean;
  keywords: { text: string; matched: boolean }[];
  summaryNote: string;
}

interface ResumeAsset {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface ResumeMatchDrawerProps {
  jobTitle: string;
  company: string;
  description: string;
  jobId?: string;
  initialMatchData?: MatchData | null;
  onClose: () => void;
  onTailorResume: () => void;
}

type Step = 1 | 2 | 3;
type RowStatus = "ok" | "fail" | "warn" | "neutral";

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
      <div style={{ position: "relative", width: 140, height: 76, overflow: "hidden" }}>
        <svg
          width="140"
          height="140"
          viewBox="0 0 130 130"
          style={{ position: "absolute", top: 0, left: 0, transform: "rotate(180deg)" }}
        >
          <defs>
            <linearGradient id="gauge-bg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C4574A" stopOpacity="0.25" />
              <stop offset="45%" stopColor="#C4A86A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4A8B6A" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          {/* Gradient background track showing full spectrum */}
          <circle
            cx="65" cy="65" r={r}
            stroke="url(#gauge-bg-grad)" strokeWidth="14" fill="none"
            strokeDasharray={`${circ * 0.5} ${circ * 0.5}`}
            strokeLinecap="round"
          />
          {/* Active fill — solid color matching score level */}
          <circle
            cx="65" cy="65" r={r}
            stroke={color} strokeWidth="14" fill="none"
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>
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
  status: RowStatus;
}) {
  const icon = status === "ok" ? "✓" : status === "fail" ? "✗" : status === "warn" ? "!" : "–";
  const iconColor =
    status === "ok" ? "#3D7A5B"
    : status === "fail" ? "#B84040"
    : status === "warn" ? "#B88A30"
    : "#A09890";
  const iconBg =
    status === "ok" ? "rgba(61,122,91,0.13)"
    : status === "fail" ? "rgba(184,64,64,0.12)"
    : status === "warn" ? "rgba(184,138,48,0.12)"
    : "rgba(0,0,0,0.05)";
  const rowBg =
    status === "ok" ? "rgba(74,139,106,0.045)"
    : status === "fail" ? "rgba(196,87,74,0.045)"
    : status === "warn" ? "rgba(196,168,106,0.04)"
    : "transparent";
  const leftBorderColor =
    status === "ok" ? "#4A8B6A"
    : status === "fail" ? "#C4574A"
    : status === "warn" ? "#C4A86A"
    : "transparent";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "136px 30px 1fr 1fr",
        gap: 12,
        alignItems: "start",
        padding: "13px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        background: rowBg,
        borderLeft: status !== "neutral" ? `3px solid ${leftBorderColor}` : "3px solid transparent",
      }}
    >
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, color: "#52493F" }}>
        {label}
      </span>
      <div
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
      </div>
      <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", lineHeight: 1.55 }}>
        {left}
      </div>
      <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", lineHeight: 1.55 }}>
        {right}
      </div>
    </div>
  );
}

export function ResumeMatchDrawer({
  jobTitle,
  company,
  description,
  jobId,
  initialMatchData,
  onClose,
  onTailorResume,
}: ResumeMatchDrawerProps) {
  const [data, setData] = useState<MatchData | null>(initialMatchData ?? null);
  const [loading, setLoading] = useState(!initialMatchData);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [aligning, setAligning] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [mounted, setMounted] = useState(false);
  const [resumeAssets, setResumeAssets] = useState<ResumeAsset[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(["summary", "skills", "work_experience"]));
  const [workEditMode, setWorkEditMode] = useState<"quick" | "full">("quick");
  const [selectedMissingKw, setSelectedMissingKw] = useState<string[]>([]);
  const kwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Fetch user's resume assets for the selector
  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((assets: ResumeAsset[]) => {
        if (Array.isArray(assets)) {
          setResumeAssets(assets.filter((a: ResumeAsset & { type?: string }) => (a as ResumeAsset & { type?: string }).type === "RESUME"));
        }
      })
      .catch(() => {});
  }, []);

  function generate(overrideDesc?: string) {
    setLoading(true);
    setError(null);
    setData(null);
    const body = jobId
      ? { jobId, jobTitle, company, description: overrideDesc !== undefined ? overrideDesc : (description || undefined) }
      : { jobTitle, company, description: overrideDesc !== undefined ? overrideDesc : description };
    fetch("/api/ai/job-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    if (!initialMatchData) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTitle, company, description]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function handleAlign() {
    setStep(2);
  }

  function handleGenerate() {
    setStep(3);
    setAligning(true);
    setTimeout(() => setAligning(false), 2000);
  }

  // Derive job title match if AI didn't return it explicitly
  function deriveJobTitleMatch(d: MatchData): boolean {
    if (d.jobTitleMatch !== undefined) return d.jobTitleMatch;
    const reqWords = d.jobTitle.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    if (!reqWords.length) return true;
    const resumeLower = d.resumeTitle.toLowerCase();
    return reqWords.filter((w) => resumeLower.includes(w)).length >= Math.ceil(reqWords.length * 0.5);
  }

  const scoreColor =
    data && data.score >= 8 ? "#4A8B6A"
    : data && data.score >= 6 ? "#C4A86A"
    : "#C4574A";

  const primaryResume = resumeAssets.find((a) => a.isPrimary) ?? resumeAssets[0];

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
          width: "min(960px, 85vw)",
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
                width: 38,
                height: 38,
                borderRadius: 9,
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 15,
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

              {data && (() => {
                const matchedKwCount = data.keywords.filter((k) => k.matched).length;
                const totalKwCount = data.keywords.length + customKeywords.length;
                const kwMatchPct = totalKwCount > 0 ? matchedKwCount / totalKwCount : 0;
                const kwStatus: RowStatus = kwMatchPct >= 0.7 ? "ok" : kwMatchPct >= 0.4 ? "warn" : "fail";
                const jobTitleMatch = deriveJobTitleMatch(data);
                const summaryStatus: RowStatus = data.score >= 7 ? "ok" : data.score >= 5 ? "warn" : "fail";

                return (
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
                            fontSize: 24,
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
                        border: "1px solid rgba(0,0,0,0.08)",
                        marginBottom: 8,
                        overflow: "hidden",
                      }}
                    >
                      {/* Column headers */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "136px 30px 1fr 1fr",
                          gap: 12,
                          padding: "10px 16px",
                          background: "rgba(0,0,0,0.02)",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>
                          Overview
                        </span>
                        <span />
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>
                          Job Requires
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Your Resume
                          </span>
                          {primaryResume && (
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-dm-sans), system-ui",
                                color: "#1A3A2F",
                                fontWeight: 500,
                                background: "rgba(26,58,47,0.07)",
                                padding: "1px 6px",
                                borderRadius: 4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 120,
                              }}
                              title={primaryResume.name}
                            >
                              {primaryResume.name.replace(/\.[^.]+$/, "").replace(/-/g, " ").slice(0, 18)}…
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rows — no outer padding; each Row owns its own padding */}
                      <Row
                        label="Job Title"
                        left={data.jobTitle}
                        right={data.resumeTitle}
                        status={jobTitleMatch ? "ok" : "fail"}
                      />
                      <Row
                        label="Experience"
                        left={data.yoeRequired}
                        right={data.yoeCandidate}
                        status={data.yoeMatch ? "ok" : "warn"}
                      />
                      <Row
                        label="Industry Experience"
                        left={
                          <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {data.industries.slice(0, 4).map((ind) => (
                              <span
                                key={ind}
                                style={{
                                  padding: "2px 7px",
                                  background: "rgba(0,0,0,0.05)",
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontFamily: "var(--font-dm-sans), system-ui",
                                }}
                              >
                                {ind}
                              </span>
                            ))}
                          </span>
                        }
                        right={data.industryMatch ? "Relevant experience" : "Limited overlap"}
                        status={data.industryMatch ? "ok" : "warn"}
                      />

                      {/* Keywords row — in the table */}
                      <Row
                        label={`Job Keywords (${matchedKwCount}/${totalKwCount})`}
                        left={
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingTop: 2 }}>
                            {data.keywords.map((kw) => (
                              <span
                                key={kw.text}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: "3px 8px",
                                  borderRadius: 12,
                                  fontFamily: "var(--font-dm-sans), system-ui",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  background: kw.matched ? "rgba(74,139,106,0.1)" : "rgba(196,87,74,0.07)",
                                  color: kw.matched ? "#1C3A2F" : "#7A2A20",
                                  border: `1px solid ${kw.matched ? "rgba(74,139,106,0.2)" : "rgba(196,87,74,0.15)"}`,
                                }}
                              >
                                <span style={{ fontSize: 10, fontWeight: 700 }}>{kw.matched ? "✓" : "✗"}</span>
                                {kw.text}
                              </span>
                            ))}
                            {customKeywords.map((kw) => (
                              <span
                                key={`custom-${kw}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: "3px 6px 3px 8px",
                                  borderRadius: 12,
                                  fontFamily: "var(--font-dm-sans), system-ui",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  background: "rgba(196,87,74,0.07)",
                                  color: "#7A2A20",
                                  border: "1px dashed rgba(196,87,74,0.3)",
                                }}
                              >
                                <span style={{ fontSize: 10 }}>+</span>
                                {kw}
                                <button
                                  type="button"
                                  onClick={() => setCustomKeywords((prev) => prev.filter((k) => k !== kw))}
                                  style={{ background: "none", border: "none", padding: "0 1px", cursor: "pointer", color: "#C4574A", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center" }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
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
                              placeholder="+ Add"
                              style={{
                                fontSize: 12,
                                fontFamily: "var(--font-dm-sans), system-ui",
                                color: "#52493F",
                                background: "transparent",
                                border: "1px dashed rgba(0,0,0,0.2)",
                                borderRadius: 12,
                                padding: "3px 10px",
                                outline: "none",
                                width: newKw ? `${Math.max(80, newKw.length * 8 + 20)}px` : 64,
                                transition: "width 0.15s ease, border-color 0.15s ease",
                                cursor: "text",
                              }}
                              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(74,139,106,0.5)"; }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)";
                                const val = newKw.trim();
                                if (val && !data.keywords.some((k) => k.text.toLowerCase() === val.toLowerCase()) && !customKeywords.includes(val)) {
                                  setCustomKeywords((prev) => [...prev, val]);
                                }
                                setNewKw("");
                              }}
                            />
                          </div>
                        }
                        right={
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: kwStatus === "ok" ? "#3D7A5B" : kwStatus === "warn" ? "#B88A30" : "#B84040",
                            }}
                          >
                            {matchedKwCount}/{totalKwCount} matched
                          </span>
                        }
                        status={kwStatus}
                      />

                      <Row
                        label="Summary"
                        left={<span style={{ color: "#52493F", fontStyle: "italic" }}>{data.summaryNote}</span>}
                        right=""
                        status={summaryStatus}
                      />
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && data && (() => {
            const unmatchedKw = data.keywords.filter((k) => !k.matched);
            const allSelected = unmatchedKw.length > 0 && unmatchedKw.every((k) => selectedMissingKw.includes(k.text));

            function toggleSection(key: string) {
              setSelectedSections((prev) => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              });
            }

            function toggleKw(text: string) {
              setSelectedMissingKw((prev) =>
                prev.includes(text) ? prev.filter((k) => k !== text) : [...prev, text]
              );
            }

            const SectionRow = ({ id, label }: { id: string; label: string }) => {
              const checked = selectedSections.has(id);
              return (
                <div
                  onClick={() => toggleSection(id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 14px",
                    borderRadius: 8,
                    border: `1px solid ${checked ? "rgba(26,58,47,0.22)" : "rgba(0,0,0,0.08)"}`,
                    background: checked ? "rgba(26,58,47,0.04)" : "#FAFAF9",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${checked ? "#1A3A2F" : "rgba(0,0,0,0.2)"}`,
                      background: checked ? "#1A3A2F" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {checked && <span style={{ color: "#E8D5A3", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 500, color: "#1A1A1A" }}>
                    {label}
                  </span>
                </div>
              );
            };

            return (
              <div style={{ display: "flex", gap: 28 }}>
                {/* Left: Section selector */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#A09890", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    1. Choose sections to enhance
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <SectionRow id="summary" label="Summary" />
                    <SectionRow id="skills" label="Skills" />
                    <SectionRow id="work_experience" label="Work Experience" />
                    {selectedSections.has("work_experience") && (
                      <div style={{ marginLeft: 30, display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
                        {(["quick", "full"] as const).map((mode) => (
                          <div
                            key={mode}
                            onClick={() => setWorkEditMode(mode)}
                            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0", userSelect: "none" }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                border: `2px solid ${workEditMode === mode ? "#1A3A2F" : "rgba(0,0,0,0.2)"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                transition: "border-color 0.15s ease",
                              }}
                            >
                              {workEditMode === mode && (
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A3A2F" }} />
                              )}
                            </div>
                            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F" }}>
                              {mode === "quick" ? "Quick Edit (First 2 key experiences)" : "Full Edit (All experiences)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Missing keywords */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                      2. Add missing keywords ({selectedMissingKw.length}/{unmatchedKw.length})
                    </p>
                    {unmatchedKw.length > 0 && (
                      <button
                        type="button"
                        onClick={() => allSelected ? setSelectedMissingKw([]) : setSelectedMissingKw(unmatchedKw.map((k) => k.text))}
                        style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#1A3A2F", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}
                      >
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>
                  {unmatchedKw.length === 0 ? (
                    <div style={{ padding: "20px 16px", background: "rgba(74,139,106,0.06)", borderRadius: 8, border: "1px solid rgba(74,139,106,0.15)", textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#3D7A5B", fontWeight: 500 }}>
                        ✓ Your resume already matches all detected keywords
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {unmatchedKw.map((kw) => {
                        const active = selectedMissingKw.includes(kw.text);
                        return (
                          <button
                            key={kw.text}
                            type="button"
                            onClick={() => toggleKw(kw.text)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 12px",
                              borderRadius: 20,
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              border: `1px solid ${active ? "rgba(26,58,47,0.3)" : "rgba(0,0,0,0.1)"}`,
                              background: active ? "rgba(26,58,47,0.08)" : "#FAFAF9",
                              color: active ? "#1A3A2F" : "#52493F",
                            }}
                          >
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 3,
                                border: `1.5px solid ${active ? "#1A3A2F" : "rgba(0,0,0,0.2)"}`,
                                background: active ? "#1A3A2F" : "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                transition: "all 0.15s ease",
                              }}
                            >
                              {active && <span style={{ color: "#E8D5A3", fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            {kw.text}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20, paddingTop: 60 }}>
              {aligning ? (
                <>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      border: "3px solid rgba(26,58,47,0.12)",
                      borderTopColor: "#1A3A2F",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>
                    Tailoring your resume…
                  </p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>
                    Weaving in your selected keywords and enhancing each section
                  </p>
                </>
              ) : (
                <>
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
                      Tailored for <strong>{jobTitle}</strong> at <strong>{company}</strong>.
                      <br />Download below or go back to make changes.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{
                        padding: "12px 24px",
                        background: "transparent",
                        color: "#52493F",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 10,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "12px 28px",
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
                      Download Resume
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {step === 1 && data && (
          <div style={{ padding: "16px 32px", borderTop: "1px solid rgba(0,0,0,0.07)", flexShrink: 0, background: "#FFFFFF" }}>
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
        {step === 2 && (
          <div style={{ padding: "16px 32px", borderTop: "1px solid rgba(0,0,0,0.07)", flexShrink: 0, background: "#FFFFFF", display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: "14px 20px",
                background: "transparent",
                color: "#52493F",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 10,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={selectedSections.size === 0}
              style={{
                flex: 1,
                padding: "14px",
                background: selectedSections.size > 0 ? "#1A3A2F" : "rgba(0,0,0,0.05)",
                color: selectedSections.size > 0 ? "#E8D5A3" : "#A09890",
                border: "none",
                borderRadius: 10,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 14,
                fontWeight: 600,
                cursor: selectedSections.size > 0 ? "pointer" : "not-allowed",
                letterSpacing: "0.3px",
              }}
            >
              Generate My Tailored Resume →
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

