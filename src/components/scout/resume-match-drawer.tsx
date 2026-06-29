"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fontSans, fontMono, color, drawerType as DT } from "@/lib/typography";
import { GrowthMatchOffer, GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { friendlyResumeError } from "@/lib/user-facing-copy";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { notifyCreditsChanged } from "@/lib/credits";
import { useSubscription } from "@/hooks/useSubscription";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoreExplainerPopover } from "./score-explainer-popover";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { scoutPrimaryCtaStyle } from "./scout-box";
import { MasterResumeGate } from "./master-resume-gate";
import { useMasterResumeStatus } from "@/hooks/use-master-resume-status";
import { DRAWER_NESTED_BACKDROP_Z, DRAWER_NESTED_Z } from "@/lib/z-layers";
import {
  BigScoreGauge,
  IndustryTag,
  MatchComparisonRow,
  MatchKeywordTag,
  ResumeSelectDropdown,
  SmallScoreGauge,
  scoreColor,
  type MatchData,
  type ResumeAssetOption,
  type RowStatus,
} from "./job-match-ui";

export type { MatchData } from "./job-match-ui";

interface TailoredData {
  tailoredText: string;
  changes: string[];
  newScore: number;
  tweaks: { id: string; label: string }[];
  injectedKeywords: string[];
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
  initialAssetId?: string | null;
  onClose: () => void;
  onTailorResume: () => void;
}

type Step = 1 | 2 | 3;

const STEPS = [
  { n: 1 as Step, label: "See the gap" },
  { n: 2 as Step, label: "Align your resume" },
  { n: 3 as Step, label: "Review the draft" },
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
                color: step >= s.n ? "#E8D5A3" : "var(--scout-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: fontSans,
                flexShrink: 0,
              }}
            >
              {step > s.n ? "✓" : s.n}
            </div>
            <span
              style={{
                fontSize: DT.caption,
                fontWeight: step === s.n ? 600 : 500,
                color: step === s.n ? color.ink : color.muted,
                whiteSpace: "nowrap",
                fontFamily: fontSans,
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

function renderLineWithKeywords(line: string, keywords: string[]): React.ReactNode {
  if (!keywords.length || !line.trim()) return line;
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = line.split(pattern);
  return parts.map((part, i) => {
    const isKw = keywords.some((k) => k.toLowerCase() === part.toLowerCase());
    return isKw ? (
      <mark
        key={i}
        style={{
          background: "rgba(74,139,106,0.2)",
          color: "#1A3A2F",
          borderRadius: 2,
          padding: "0 2px",
          fontWeight: 600,
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

function HighlightedResume({ text, keywords }: { text: string; keywords: string[] }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const isSectionHeader =
          trimmed.length > 0 &&
          trimmed.length < 50 &&
          /^[A-Z][A-Z\s&/\-.]{3,}$/.test(trimmed);
        const content = renderLineWithKeywords(line, keywords);
        return (
          <div
            key={i}
            style={{
              fontFamily: fontSans,
              fontSize: isSectionHeader ? 10 : 12,
              fontWeight: isSectionHeader ? 700 : 400,
              color: isSectionHeader ? "#52493F" : "#1A1A1A",
              borderBottom: isSectionHeader ? "1px solid rgba(0,0,0,0.1)" : "none",
              marginTop: isSectionHeader && i > 0 ? 14 : 0,
              paddingBottom: isSectionHeader ? 4 : 0,
              letterSpacing: isSectionHeader ? "0.8px" : "normal",
              lineHeight: 1.65,
              minHeight: !trimmed ? 6 : undefined,
            }}
          >
            {content || " "}
          </div>
        );
      })}
    </div>
  );
}

export function ResumeMatchDrawer({
  jobTitle,
  company,
  description,
  jobId,
  initialMatchData,
  initialAssetId,
  onClose,
  onTailorResume,
}: ResumeMatchDrawerProps) {
  const [data, setData] = useState<MatchData | null>(initialMatchData ?? null);
  const [loading, setLoading] = useState(false);
  const [hasRequestedAnalysis, setHasRequestedAnalysis] = useState(Boolean(initialMatchData));
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [aligning, setAligning] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [mounted, setMounted] = useState(false);
  const [resumeAssets, setResumeAssets] = useState<ResumeAssetOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(initialAssetId ?? null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(["summary", "skills", "work_experience"])
  );
  const [workEditMode, setWorkEditMode] = useState<"quick" | "full">("quick");
  const [selectedMissingKw, setSelectedMissingKw] = useState<string[]>([]);
  const [tailoredData, setTailoredData] = useState<TailoredData | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [applyingTweakId, setApplyingTweakId] = useState<string | null>(null);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const { openPricing, withClientScope } = useWorkspace();
  const { isPro, isAdmin } = useSubscription();
  const masterResume = useMasterResumeStatus();
  const proUser = isPro || isAdmin;
  const kwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch(withClientScope("/api/assets"))
      .then((r) => r.json())
      .then((assets: Array<ResumeAsset & { type?: string }>) => {
        if (!Array.isArray(assets)) return;
        const resumes = assets
          .filter((a) => a.type === "RESUME")
          .map((a) => ({ id: a.id, name: a.name, isPrimary: a.isPrimary }));
        setResumeAssets(resumes);
        if (!selectedResumeId && resumes.length) {
          const primary = resumes.find((r) => r.isPrimary) ?? resumes[0];
          setSelectedResumeId(primary.id);
        }
      })
      .catch(() => {});
    masterResume.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when client scope changes
  }, [withClientScope]);

  const activeResumeId =
    selectedResumeId ?? resumeAssets.find((a) => a.isPrimary)?.id ?? resumeAssets[0]?.id ?? null;

  function generate(overrideDesc?: string, assetId = activeResumeId) {
    setHasRequestedAnalysis(true);
    setLoading(true);
    setError(null);
    setData(null);
    const desc =
      overrideDesc !== undefined ? overrideDesc : description || undefined;
    const body = jobId
      ? { jobId, jobTitle, company, description: desc, assetId: assetId ?? undefined }
      : { jobTitle, company, description: desc ?? "", assetId: assetId ?? undefined };
    fetch(withClientScope("/api/ai/job-match"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          setError(d.error ?? "Monthly AI limit reached");
          return;
        }
        if (r.status === 503) {
          setError(d.error === "AI not configured" ? "AI isn't available in this environment — try on production." : (d.error ?? "AI isn't available right now."));
          return;
        }
        if (d.error) setError(d.error);
        else {
          setData(d);
          notifyCreditsChanged();
        }
      })
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function handleAlign() {
    setStep(2);
  }

  async function handleGenerate() {
    setStep(3);
    setAligning(true);
    setTailoredData(null);
    setGenerateError(null);
    try {
      const res = await fetch(withClientScope("/api/ai/tailor-resume"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          company,
          description: description || manualDesc || undefined,
          jobId,
          assetId: activeResumeId ?? undefined,
          selectedSections: Array.from(selectedSections),
          missingKeywords: selectedMissingKw,
          workEditMode,
        }),
      });
      if (res.status === 402) {
        notifyCreditsChanged();
        setShowUpgrade(true);
        setGenerateError("Monthly AI limit reached");
        setStep(3);
        return;
      }
      if (res.status === 503) {
        const d = await readResponseJson(res).catch(() => ({}));
        setGenerateError(
          d.error === "AI not configured"
            ? "AI isn't available in this environment — try on production."
            : formatApiErrorMessage(d.error, "AI isn't available right now."),
        );
        return;
      }
      const json = await readResponseJson(res);
      if (!res.ok || json.error) {
        setGenerateError(formatApiErrorMessage(json.error, "Something went wrong — try again."));
        return;
      }
      setTailoredData(json as TailoredData);
      notifyCreditsChanged();
    } catch (err) {
      setGenerateError(formatApiErrorMessage(err, "Something went wrong — try again."));
    } finally {
      setAligning(false);
    }
  }

  async function applyTweak(tweak: { id: string; label: string }) {
    if (!tailoredData || applyingTweakId) return;
    setApplyingTweakId(tweak.id);
    try {
      const res = await fetch(withClientScope("/api/ai/apply-resume-tweak"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredText: tailoredData.tailoredText,
          tweakLabel: tweak.label,
          jobTitle,
          company,
        }),
      });
      if (res.status === 402) {
        notifyCreditsChanged();
        setShowUpgrade(true);
        return;
      }
      const json = await res.json();
      if (json.error) setGenerateError(json.error);
      else if (json.tailoredText) {
        setTailoredData({
          ...tailoredData,
          tailoredText: json.tailoredText,
          tweaks: tailoredData.tweaks.filter((t) => t.id !== tweak.id),
          changes: [...tailoredData.changes, json.changeSummary ?? `Applied: ${tweak.label}`],
        });
        notifyCreditsChanged();
      }
    } catch {
      setGenerateError("Couldn't apply that tweak — try again.");
    } finally {
      setApplyingTweakId(null);
    }
  }

  async function exportResume(format: "pdf" | "docx") {
    if (!tailoredData) return;
    setDownloadingExport(true);
    setDownloadMenuOpen(false);
    try {
      const res = await fetch(withClientScope("/api/resume/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: tailoredData.tailoredText,
          format,
          filename: `${company}-${jobTitle}-tailored`,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${company}-${jobTitle}-tailored.${format}`.replace(/[^a-z0-9.-]/gi, "-").toLowerCase();
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloadingExport(false);
    }
  }

  async function saveAndOpenEditor() {
    if (!tailoredData) return;
    if (!jobId) {
      onTailorResume();
      return;
    }
    setCommitting(true);
    setGenerateError(null);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/commit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredText: tailoredData.tailoredText,
          sourceAssetId: activeResumeId,
          injectedKeywords: tailoredData.injectedKeywords,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateError((json as { error?: string }).error ?? "Couldn't save tailored resume — try again.");
        return;
      }
      handleClose();
      onTailorResume();
    } catch {
      setGenerateError("Couldn't save tailored resume — try again.");
    } finally {
      setCommitting(false);
    }
  }

  function deriveJobTitleMatch(d: MatchData): boolean {
    if (d.jobTitleMatch !== undefined) return d.jobTitleMatch;
    const reqWords = d.jobTitle
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    if (!reqWords.length) return true;
    const resumeLower = d.resumeTitle.toLowerCase();
    return (
      reqWords.filter((w) => resumeLower.includes(w)).length >=
      Math.ceil(reqWords.length * 0.5)
    );
  }

  const headlineScoreColor = data ? scoreColor(data.score) : color.forest;

  const selectedResume =
    resumeAssets.find((a) => a.id === activeResumeId) ??
    resumeAssets.find((a) => a.isPrimary) ??
    resumeAssets[0];

  function handleResumeChange(assetId: string) {
    setSelectedResumeId(assetId);
    if (hasRequestedAnalysis || initialMatchData) {
      generate(undefined, assetId);
    }
  }

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
          zIndex: DRAWER_NESTED_BACKDROP_Z,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />

      {/* Drawer */}
      <div
        className="bruddle"
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(960px, 85vw)",
          background: "#FFFFFF",
          borderLeft: "var(--scout-border)",
          zIndex: DRAWER_NESTED_Z,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 4px 0 #161616",
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
                borderRadius: "var(--scout-radius)",
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: fontSans,
                fontSize: 15,
                fontWeight: 700,
                color: "#E8D5A3",
                flexShrink: 0,
              }}
            >
              {company.charAt(0).toUpperCase()}
            </div>
            <div>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1A1A1A",
                }}
              >
                {company}
              </p>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: 14,
                  color: "var(--scout-muted)",
                }}
              >
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
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: step === 3 && tailoredData ? "24px 28px" : "28px 32px",
          }}
        >
          <CreditsStatusBar />
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {!masterResume.loading && !masterResume.hasMasterResume ? (
                <MasterResumeGate
                  canCreateFromProfile={masterResume.canCreateFromProfile}
                  onCreateFromProfile={async () => {
                    const assetId = await masterResume.createFromProfile();
                    if (assetId) {
                      setResumeAssets([{ id: assetId, name: "My Resume", isPrimary: true }]);
                      setSelectedResumeId(assetId);
                    }
                  }}
                  creating={masterResume.creating}
                  createError={masterResume.createError}
                  compact
                />
              ) : (
              <>
              {loading && <KimchiProcessLoader preset="jobMatch" variant="centered" />}

              {!loading && !data && !error && !hasRequestedAnalysis && (
                <div style={{ paddingTop: 12, textAlign: "center" }}>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, marginBottom: 16, lineHeight: 1.55 }}>
                    Compare your resume to this role — keyword gaps, title fit, and a score.
                  </p>
                  <button
                    type="button"
                    onClick={() => generate()}
                    style={{
                      padding: "12px 20px",
                      background: color.forest,
                      color: color.gold,
                      border: "none",
                      fontFamily: fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Analyze fit →
                  </button>
                </div>
              )}

              {error && (() => {
                const friendly = friendlyResumeError(error);
                return (
                <div style={{ paddingTop: 20 }}>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      marginBottom: 8,
                    }}
                  >
                    {friendly.headline}
                  </p>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: 14,
                      color: friendly.isMissingResume ? "#52493F" : "#C4574A",
                      marginBottom:
                        friendly.isMissingResume || error === "No job description provided" ? 14 : 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {friendly.body}
                  </p>
                  {friendly.isMissingResume && (
                    <a
                      href="/profile"
                      style={{
                        display: "inline-block",
                        padding: "10px 16px",
                        background: color.forest,
                        color: color.gold,
                        fontFamily: fontSans,
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: "none",
                        marginBottom: 10,
                      }}
                    >
                      Go to Profile →
                    </a>
                  )}
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
                          borderRadius: "var(--scout-radius)",
                          fontFamily: fontSans,
                          fontSize: 14,
                          color: "#1A1A1A",
                          resize: "vertical",
                          background: "#FAFAFA",
                          lineHeight: 1.6,
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => {
                          if (manualDesc.trim()) generate(manualDesc.trim());
                        }}
                        disabled={!manualDesc.trim()}
                        style={{
                          padding: "12px",
                          background: manualDesc.trim()
                            ? "#1A3A2F"
                            : "rgba(0,0,0,0.05)",
                          color: manualDesc.trim() ? "#E8D5A3" : "var(--scout-muted)",
                          border: "none",
                          borderRadius: "var(--scout-radius)",
                          fontFamily: fontSans,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: manualDesc.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        Analyze fit →
                      </button>
                    </div>
                  )}
                </div>
                );
              })()}

              {data &&
                (() => {
                  const matchedKwCount = data.keywords.filter(
                    (k) => k.matched
                  ).length;
                  const totalKwCount =
                    data.keywords.length + customKeywords.length;
                  const kwMatchPct =
                    totalKwCount > 0 ? matchedKwCount / totalKwCount : 0;
                  const kwStatus: RowStatus =
                    kwMatchPct >= 0.7
                      ? "ok"
                      : kwMatchPct >= 0.4
                      ? "warn"
                      : "fail";
                  const jobTitleMatch = deriveJobTitleMatch(data);
                  const summaryStatus: RowStatus =
                    data.score >= 7 ? "ok" : data.score >= 5 ? "warn" : "fail";

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
                          background: "var(--scout-inset)",
                          borderRadius: "var(--scout-radius)",
                          border: "1px solid rgba(0,0,0,0.05)",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontFamily: fontSans,
                              fontSize: 24,
                              fontWeight: 700,
                              color: "#1A1A1A",
                              marginBottom: 8,
                              lineHeight: 1.3,
                            }}
                          >
                            Your Resume is a{" "}
                            <span style={{ color: headlineScoreColor }}>
                              {data.scoreLabel}
                            </span>{" "}
                            Match
                          </p>
                          {data.score < 6 && (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 12px",
                                background: "rgba(196,87,74,0.08)",
                                borderRadius: "var(--scout-radius)",
                                border: "1px solid rgba(196,87,74,0.15)",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 14,
                                  color: "#C4574A",
                                  fontFamily: fontSans,
                                }}
                              >
                                ⓘ
                              </span>
                              <p
                                style={{
                                  fontFamily: fontSans,
                                  fontSize: 14,
                                  color: "#C4574A",
                                }}
                              >
                                Resumes under 6.0 are likely to be filtered out
                                — we&apos;ll help you fix it fast.
                              </p>
                            </div>
                          )}
                          {data.score >= 6 && data.score < 8 && (
                            <p
                              style={{
                                fontFamily: fontSans,
                                fontSize: 14,
                                color: "#52493F",
                                lineHeight: 1.55,
                              }}
                            >
                              Solid foundation. A few targeted tweaks could push
                              you into strong match territory.
                            </p>
                          )}
                          {data.score >= 8 && (
                            <p
                              style={{
                                fontFamily: fontSans,
                                fontSize: 14,
                                color: "#52493F",
                                lineHeight: 1.55,
                              }}
                            >
                              You&apos;re a strong candidate for this role.
                            </p>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, marginLeft: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <ScoreExplainerPopover variant="job-match" align="right" />
                          <BigScoreGauge score={data.score} />
                        </div>
                      </div>

                      {data.score < 6 && !proUser && (
                        <GrowthMatchOffer
                          isPro={proUser}
                          onUpgrade={openPricing}
                        />
                      )}

                      {/* Comparison table */}
                      <div
                        style={{
                          background: "#FFFFFF",
                          borderRadius: "var(--scout-radius)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          marginBottom: 8,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "148px 30px 1fr 1fr",
                            gap: 12,
                            padding: "10px 16px",
                            background: "rgba(0,0,0,0.02)",
                            borderBottom: "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: fontSans,
                              fontSize: 14,
                              fontWeight: 700,
                              color: color.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Overview
                          </span>
                          <span />
                          <span
                            style={{
                              fontFamily: fontSans,
                              fontSize: 14,
                              fontWeight: 700,
                              color: color.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Job Requires
                          </span>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontFamily: fontSans,
                                fontSize: 14,
                                fontWeight: 700,
                                color: color.muted,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              Your Resume
                            </span>
                            {resumeAssets.length > 0 && activeResumeId && (
                              <ResumeSelectDropdown
                                assets={resumeAssets}
                                value={activeResumeId}
                                onChange={handleResumeChange}
                                compact
                              />
                            )}
                          </div>
                        </div>

                        <MatchComparisonRow
                          label="Overview"
                          left={
                            <div>
                              <p style={{ margin: "0 0 4px", fontWeight: 700, color: color.ink }}>{company}</p>
                              <p style={{ margin: 0, color: color.muted }}>{data.jobTitle}</p>
                            </div>
                          }
                          right={
                            selectedResume ? (
                              <p style={{ margin: 0, fontWeight: 600, color: color.ink }}>
                                {selectedResume.name.replace(/\.[^.]+$/, "")}
                              </p>
                            ) : (
                              "—"
                            )
                          }
                          status="neutral"
                        />

                        <MatchComparisonRow
                          label="Job Title"
                          left={data.jobTitle}
                          right={data.resumeTitle}
                          status={jobTitleMatch ? "ok" : "fail"}
                        />
                        <MatchComparisonRow
                          label="Years of Experience"
                          left={data.yoeRequired}
                          right={data.yoeCandidate}
                          status={data.yoeMatch ? "ok" : "warn"}
                        />
                        <MatchComparisonRow
                          label="Industry Experience"
                          left={
                            <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {data.industries.slice(0, 6).map((ind) => (
                                <IndustryTag key={ind} label={ind} matched={data.industryMatch} />
                              ))}
                            </span>
                          }
                          right={
                            data.industryMatch
                              ? "Relevant experience"
                              : "Limited overlap"
                          }
                          status={data.industryMatch ? "ok" : "warn"}
                        />
                        <MatchComparisonRow
                          label={`Job Keywords (${matchedKwCount}/${totalKwCount})`}
                          left={
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingTop: 2 }}>
                              {data.keywords.map((kw) => (
                                <MatchKeywordTag key={kw.text} text={kw.text} matched={kw.matched} />
                              ))}
                              {customKeywords.map((kw) => (
                                <span
                                  key={`custom-${kw}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    padding: "3px 6px 3px 8px",
                                    borderRadius: "var(--scout-radius)",
                                    fontFamily: fontSans,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    background: "rgba(196,87,74,0.07)",
                                    color: "#7A2A20",
                                    border: "1px dashed rgba(196,87,74,0.3)",
                                  }}
                                >
                                  <span style={{ fontSize: 14 }}>+</span>
                                  {kw}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCustomKeywords((prev) =>
                                        prev.filter((k) => k !== kw)
                                      )
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      padding: "0 1px",
                                      cursor: "pointer",
                                      color: "#C4574A",
                                      fontSize: 14,
                                      lineHeight: 1,
                                      display: "flex",
                                      alignItems: "center",
                                    }}
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
                                    if (
                                      val &&
                                      !data.keywords.some(
                                        (k) =>
                                          k.text.toLowerCase() ===
                                          val.toLowerCase()
                                      ) &&
                                      !customKeywords.includes(val)
                                    ) {
                                      setCustomKeywords((prev) => [
                                        ...prev,
                                        val,
                                      ]);
                                    }
                                    setNewKw("");
                                  }
                                  if (e.key === "Escape") setNewKw("");
                                }}
                                placeholder="+ Add"
                                style={{
                                  fontSize: 14,
                                  fontFamily: fontSans,
                                  color: "#52493F",
                                  background: "transparent",
                                  border: "1px dashed rgba(0,0,0,0.2)",
                                  borderRadius: "var(--scout-radius)",
                                  padding: "3px 10px",
                                  outline: "none",
                                  width: newKw
                                    ? `${Math.max(80, newKw.length * 8 + 20)}px`
                                    : 64,
                                  transition:
                                    "width 0.15s ease, border-color 0.15s ease",
                                  cursor: "text",
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor =
                                    "rgba(74,139,106,0.5)";
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor =
                                    "rgba(0,0,0,0.2)";
                                  const val = newKw.trim();
                                  if (
                                    val &&
                                    !data.keywords.some(
                                      (k) =>
                                        k.text.toLowerCase() ===
                                        val.toLowerCase()
                                    ) &&
                                    !customKeywords.includes(val)
                                  ) {
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
                                fontSize: 14,
                                color:
                                  kwStatus === "ok"
                                    ? "#3D7A5B"
                                    : kwStatus === "warn"
                                    ? "#B88A30"
                                    : "#B84040",
                              }}
                            >
                              {matchedKwCount}/{totalKwCount} matched
                            </span>
                          }
                          status={kwStatus}
                        />
                        <MatchComparisonRow
                          label="Summary"
                          left={
                            <span style={{ color: "#52493F", fontStyle: "italic" }}>
                              {data.summaryNote}
                            </span>
                          }
                          right=""
                          status={summaryStatus}
                        />
                      </div>

                      {proUser && (
                        <GrowthMatchOffer isPro onUpgrade={openPricing} />
                      )}
                    </>
                  );
                })()}
              </>
              )}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 &&
            data &&
            (() => {
              const unmatchedKw = data.keywords.filter((k) => !k.matched);
              const allSelected =
                unmatchedKw.length > 0 &&
                unmatchedKw.every((k) => selectedMissingKw.includes(k.text));

              function toggleSection(key: string) {
                setSelectedSections((prev) => {
                  const next = new Set(prev);
                  next.has(key) ? next.delete(key) : next.add(key);
                  return next;
                });
              }

              function toggleKw(text: string) {
                setSelectedMissingKw((prev) =>
                  prev.includes(text)
                    ? prev.filter((k) => k !== text)
                    : [...prev, text]
                );
              }

              const SectionRow = ({
                id,
                label,
              }: {
                id: string;
                label: string;
              }) => {
                const checked = selectedSections.has(id);
                return (
                  <div
                    onClick={() => toggleSection(id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      borderRadius: "var(--scout-radius)",
                      border: `1px solid ${checked ? "rgba(26,58,47,0.22)" : "rgba(0,0,0,0.08)"}`,
                      background: checked
                        ? "rgba(26,58,47,0.04)"
                        : "#FAFAF9",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      userSelect: "none",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "var(--scout-radius)",
                        border: `2px solid ${checked ? "#1A3A2F" : "rgba(0,0,0,0.2)"}`,
                        background: checked ? "#1A3A2F" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {checked && (
                        <span
                          style={{
                            color: "#E8D5A3",
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: fontSans,
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#1A1A1A",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              };

              return (
                <div style={{ display: "flex", gap: 28 }}>
                  {/* Left: Section selector */}
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontFamily: fontSans,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--scout-muted)",
                        marginBottom: 14,
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                      }}
                    >
                      1. Choose sections to enhance
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <SectionRow id="summary" label="Summary" />
                      <SectionRow id="skills" label="Skills" />
                      <SectionRow id="work_experience" label="Work Experience" />
                      {selectedSections.has("work_experience") && (
                        <div
                          style={{
                            marginLeft: 30,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            paddingTop: 2,
                          }}
                        >
                          {(["quick", "full"] as const).map((mode) => (
                            <div
                              key={mode}
                              onClick={() => setWorkEditMode(mode)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                cursor: "pointer",
                                padding: "3px 0",
                                userSelect: "none",
                              }}
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
                                  <div
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: "50%",
                                      background: "#1A3A2F",
                                    }}
                                  />
                                )}
                              </div>
                              <span
                                style={{
                                  fontFamily: fontSans,
                                  fontSize: 14,
                                  color: "#52493F",
                                }}
                              >
                                {mode === "quick"
                                  ? "Quick Edit (First 2 key experiences)"
                                  : "Full Edit (All experiences)"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Missing keywords */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                      }}
                    >
                      <p
                        style={{
                          fontFamily: fontSans,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--scout-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.8px",
                        }}
                      >
                        2. Add missing keywords ({selectedMissingKw.length}/
                        {unmatchedKw.length})
                      </p>
                      {unmatchedKw.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            allSelected
                              ? setSelectedMissingKw([])
                              : setSelectedMissingKw(
                                  unmatchedKw.map((k) => k.text)
                                )
                          }
                          style={{
                            fontFamily: fontSans,
                            fontSize: 14,
                            color: "#1A3A2F",
                            fontWeight: 600,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            textDecoration: "underline",
                            textUnderlineOffset: 2,
                          }}
                        >
                          {allSelected ? "Deselect all" : "Select all"}
                        </button>
                      )}
                    </div>
                    {unmatchedKw.length === 0 ? (
                      <div
                        style={{
                          padding: "20px 16px",
                          background: "rgba(74,139,106,0.06)",
                          borderRadius: "var(--scout-radius)",
                          border: "1px solid rgba(74,139,106,0.15)",
                          textAlign: "center",
                        }}
                      >
                        <p
                          style={{
                            fontFamily: fontSans,
                            fontSize: 14,
                            color: "#3D7A5B",
                            fontWeight: 500,
                          }}
                        >
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
                                borderRadius: "var(--scout-radius)",
                                fontFamily: fontSans,
                                fontSize: 14,
                                fontWeight: 500,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                border: `1px solid ${active ? "rgba(26,58,47,0.3)" : "rgba(0,0,0,0.1)"}`,
                                background: active
                                  ? "rgba(26,58,47,0.08)"
                                  : "#FAFAF9",
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
                                {active && (
                                  <span
                                    style={{
                                      color: "#E8D5A3",
                                      fontSize: 14,
                                      fontWeight: 700,
                                      lineHeight: 1,
                                    }}
                                  >
                                    ✓
                                  </span>
                                )}
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
            <>
              {/* Loading state */}
              {aligning && <KimchiProcessLoader preset="resumeTailor" variant="centered" />}

              {/* Error state */}
              {!aligning && generateError && (() => {
                const friendly = friendlyResumeError(generateError);
                return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 300,
                    gap: 16,
                    textAlign: "center",
                    padding: "0 24px",
                  }}
                >
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      margin: 0,
                    }}
                  >
                    {friendly.headline}
                  </p>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: 14,
                      color: "#52493F",
                      margin: 0,
                      lineHeight: 1.55,
                      maxWidth: 360,
                    }}
                  >
                    {friendly.body}
                  </p>
                  {friendly.isMissingResume && (
                    <a
                      href="/profile"
                      style={{
                        display: "inline-block",
                        padding: "10px 20px",
                        background: color.forest,
                        color: color.gold,
                        fontFamily: fontSans,
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Add a resume in Profile →
                    </a>
                  )}
                  <button
                    onClick={() => setStep(friendly.isMissingResume ? 1 : 2)}
                    style={{
                      padding: "10px 20px",
                      background: "transparent",
                      color: "#52493F",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: "var(--scout-radius)",
                      fontFamily: fontSans,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    ← Go back
                  </button>
                </div>
                );
              })()}

              {/* Result state */}
              {!aligning && tailoredData && (
                <div style={{ display: "flex", gap: 20 }}>
                  {/* Left: Resume preview */}
                  <div
                    style={{
                      flex: "0 0 57%",
                      background: "#FAFAF8",
                      borderRadius: "var(--scout-radius)",
                      border: "1px solid rgba(0,0,0,0.07)",
                      padding: "20px 22px",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                        paddingBottom: 12,
                        borderBottom: "1px solid rgba(0,0,0,0.07)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: fontSans,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--scout-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.8px",
                        }}
                      >
                        Tailored Resume
                      </span>
                      {tailoredData.injectedKeywords.length > 0 && (
                        <span
                          style={{
                            fontFamily: fontSans,
                            fontSize: 14,
                            color: "#3D7A5B",
                            background: "rgba(74,139,106,0.08)",
                            padding: "2px 8px",
                            borderRadius: "var(--scout-radius)",
                            border: "1px solid rgba(74,139,106,0.15)",
                          }}
                        >
                          {tailoredData.injectedKeywords.length} keywords added
                        </span>
                      )}
                    </div>
                    <HighlightedResume
                      text={tailoredData.tailoredText}
                      keywords={tailoredData.injectedKeywords}
                    />
                  </div>

                  {/* Right: Score + changes + tweaks */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      minWidth: 0,
                    }}
                  >
                    {/* Score jump */}
                    <div
                      style={{
                        background: "var(--scout-inset)",
                        borderRadius: "var(--scout-radius)",
                        padding: "16px 18px",
                        border: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: fontSans,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--scout-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.8px",
                          marginBottom: 12,
                        }}
                      >
                        Match Score
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        <SmallScoreGauge score={tailoredData.newScore} />
                        <div>
                          <p
                            style={{
                              fontFamily: fontSans,
                              fontSize: 14,
                              color: "#52493F",
                              marginBottom: 2,
                            }}
                          >
                            Score jumped from
                          </p>
                          <p
                            style={{
                              fontFamily: fontMono,
                              fontSize: 20,
                              fontWeight: 700,
                              color: "#1A3A2F",
                            }}
                          >
                            {data?.score?.toFixed(1) ?? "–"}{" "}
                            <span style={{ color: "var(--scout-muted)", fontWeight: 400 }}>→</span>{" "}
                            {tailoredData.newScore.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* What changed */}
                    <div>
                      <p
                        style={{
                          fontFamily: fontSans,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#1A1A1A",
                          textTransform: "uppercase",
                          letterSpacing: "0.8px",
                          marginBottom: 10,
                        }}
                      >
                        See What&apos;s Changed
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 7,
                        }}
                      >
                        {tailoredData.changes.map((change, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: 9,
                              padding: "9px 12px",
                              background: "rgba(74,139,106,0.055)",
                              borderRadius: "var(--scout-radius)",
                              border: "1px solid rgba(74,139,106,0.12)",
                            }}
                          >
                            <span
                              style={{
                                color: "#3D7A5B",
                                fontSize: 14,
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              •
                            </span>
                            <p
                              style={{
                                fontFamily: fontSans,
                                fontSize: 14,
                                color: "#1A1A1A",
                                lineHeight: 1.5,
                              }}
                            >
                              {change}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tweaks */}
                    {tailoredData.tweaks && tailoredData.tweaks.length > 0 && (
                      <div>
                        <p
                          style={{
                            fontFamily: fontSans,
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--scout-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            marginBottom: 8,
                          }}
                        >
                          Optional Tweaks
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {tailoredData.tweaks.map((tweak) => (
                            <button
                              key={tweak.id}
                              type="button"
                              disabled={!!applyingTweakId}
                              onClick={() => void applyTweak(tweak)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 14px",
                                background: applyingTweakId === tweak.id ? "#F0EDE8" : "#FAFAF9",
                                borderRadius: "var(--scout-radius)",
                                border: "1px solid rgba(0,0,0,0.08)",
                                cursor: applyingTweakId ? "wait" : "pointer",
                                width: "100%",
                                textAlign: "left",
                              }}
                            >
                              <p
                                style={{
                                  fontFamily: fontSans,
                                  fontSize: 14,
                                  color: "#52493F",
                                  lineHeight: 1.4,
                                  margin: 0,
                                }}
                              >
                                {applyingTweakId === tweak.id ? "Applying…" : tweak.label}
                              </p>
                              <span
                                style={{
                                  color: "#1A3A2F",
                                  fontSize: 16,
                                  flexShrink: 0,
                                  marginLeft: 8,
                                }}
                              >
                                ›
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTAs */}
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
                ...scoutPrimaryCtaStyle,
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
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
          <div
            style={{
              padding: "16px 32px",
              borderTop: "1px solid rgba(0,0,0,0.07)",
              flexShrink: 0,
              background: "#FFFFFF",
              display: "flex",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: "14px 20px",
                background: "transparent",
                color: "#52493F",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
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
                ...(selectedSections.size > 0 ? scoutPrimaryCtaStyle : {
                  background: "rgba(0,0,0,0.05)",
                  color: "var(--scout-muted)",
                  border: "none",
                }),
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
                cursor: selectedSections.size > 0 ? "pointer" : "not-allowed",
                letterSpacing: "0.3px",
              }}
            >
              Generate tailored resume →
            </button>
          </div>
        )}

        {step === 3 && !aligning && tailoredData && (
          <div
            style={{
              position: "relative",
              padding: "16px 32px",
              borderTop: "1px solid rgba(0,0,0,0.07)",
              flexShrink: 0,
              background: "#FFFFFF",
              display: "flex",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={committing}
              style={{
                padding: "14px 20px",
                background: "transparent",
                color: "#52493F",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 500,
                cursor: committing ? "default" : "pointer",
                flexShrink: 0,
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => void saveAndOpenEditor()}
              disabled={committing || downloadingExport}
              style={{
                flex: 1,
                padding: "14px",
                ...(committing ? {
                  background: "var(--scout-cta-muted)",
                  color: "var(--scout-cta-foreground)",
                  border: "var(--scout-border)",
                } : scoutPrimaryCtaStyle),
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
                cursor: committing ? "wait" : "pointer",
                letterSpacing: "0.3px",
              }}
            >
              {committing ? "Saving…" : jobId ? "Save & open editor →" : "Save job to continue →"}
            </button>
            <button
              type="button"
              onClick={() => setDownloadMenuOpen((v) => !v)}
              disabled={downloadingExport || committing}
              style={{
                padding: "14px 20px",
                background: "transparent",
                color: "#52493F",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
                cursor: downloadingExport ? "wait" : "pointer",
                flexShrink: 0,
              }}
            >
              {downloadingExport ? "…" : "Download"}
            </button>
            {downloadMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 32,
                  bottom: 72,
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.1)",
                  minWidth: 180,
                  zIndex: 5,
                }}
              >
                <button type="button" onClick={() => void exportResume("pdf")} style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: "none", border: "none", fontFamily: fontSans, fontSize: 13, cursor: "pointer" }}>Download PDF</button>
                <button type="button" onClick={() => void exportResume("docx")} style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: "none", border: "none", fontFamily: fontSans, fontSize: 13, cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.08)" }}>Download Word</button>
              </div>
            )}
          </div>
        )}
      </div>

      {showUpgrade && (
        <GrowthUpgradeModal
          trigger="limit_hit"
          onClose={() => setShowUpgrade(false)}
          onOpenPricing={openPricing}
        />
      )}
    </>,
    document.body
  );
}
