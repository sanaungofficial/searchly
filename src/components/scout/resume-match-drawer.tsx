"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Plus, Zap } from "lucide-react";
import { fontSans, fontMono, color, drawerType as DT } from "@/lib/typography";
import { RT } from "@/lib/resume-tailor-tokens";
import { TailoredResumePreview } from "./tailored-resume-preview";
import { ResumeStylePanel } from "./resume-style-panel";
import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  type ResumeStyleSettings,
} from "@/lib/resume-style";
import {
  plainTextToResumeSections,
  sectionsToPlainText,
  type TailoredResumeSection,
} from "@/lib/tailored-resume-sections";
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
import { isProductionEnv } from "@/lib/beta-features";
import {
  BigScoreGauge,
  IndustryTag,
  MatchComparisonRow,
  MatchKeywordTag,
  ResumeSelectDropdown,
  scoreColor,
  MATCH_ROW_GRID_SPLIT,
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
  initialAssetId?: string | null;
  autoStart?: boolean;
  /** External apply URL — Apply Now saves then opens this link. */
  applyUrl?: string | null;
  onClose: () => void;
  onTailorResume: () => void;
}

type Step = 1 | 2 | 3;
type RightPanelTab = "ai" | "editor" | "style";

const STEPS = [
  { n: 1 as Step, label: "See Your Difference" },
  { n: 2 as Step, label: "Align Your Resume" },
  { n: 3 as Step, label: "Review Your New Resume" },
];

function fallbackNoticeFor(data: MatchData): string | null {
  if (!data._fallback) return null;
  if (data._fallbackReason === "no_ai" && !isProductionEnv()) {
    return "Keyword-based match on dev — full AI on production.";
  }
  if (data._fallbackReason === "parse_error" || data._fallbackReason === "ai_error") {
    return "AI analysis unavailable — showing a keyword-based estimate.";
  }
  return null;
}

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
                background: step > s.n ? RT.stepComplete : step === s.n ? RT.stepActive : RT.stepInactive,
                color: step >= s.n ? RT.green : RT.muted,
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
                color: step === s.n ? RT.text : RT.muted,
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
                background: step > s.n ? RT.green : RT.border,
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

export function ResumeMatchDrawer({
  jobTitle,
  company,
  description,
  jobId,
  initialAssetId,
  autoStart = true,
  applyUrl,
  onClose,
  onTailorResume,
}: ResumeMatchDrawerProps) {
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRequestedAnalysis, setHasRequestedAnalysis] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
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
  const [editorSections, setEditorSections] = useState<TailoredResumeSection[]>([]);
  const [rightTab, setRightTab] = useState<RightPanelTab>("ai");
  const [resumeStyle, setResumeStyle] = useState<ResumeStyleSettings>(DEFAULT_RESUME_STYLE);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const { openPricing, withClientScope } = useWorkspace();
  const { isPro, isAdmin } = useSubscription();
  const masterResume = useMasterResumeStatus();
  const proUser = isPro || isAdmin;
  const autoStartedRef = useRef(false);
  const kwInputRef = useRef<HTMLInputElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

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
    setFallbackNotice(null);
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
          setFallbackNotice(fallbackNoticeFor(d));
          notifyCreditsChanged();
        }
      })
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [downloadMenuOpen]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    if (masterResume.loading || !masterResume.hasMasterResume) return;
    if (!activeResumeId) return;
    autoStartedRef.current = true;
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when resume is ready
  }, [autoStart, masterResume.loading, masterResume.hasMasterResume, activeResumeId]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function handleAlign() {
    if (data) {
      const unmatched = data.keywords.filter((k) => !k.matched).map((k) => k.text);
      setSelectedMissingKw(unmatched);
    }
    setStep(2);
  }

  async function handleGenerate() {
    setStep(3);
    setAligning(true);
    setTailoredData(null);
    setEditorSections([]);
    setGenerateError(null);
    setRightTab("ai");
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
      setEditorSections(plainTextToResumeSections((json as TailoredData).tailoredText));
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
        const next: TailoredData = {
          ...tailoredData,
          tailoredText: json.tailoredText,
          tweaks: tailoredData.tweaks.filter((t) => t.id !== tweak.id),
          changes: [...tailoredData.changes, json.changeSummary ?? `Applied: ${tweak.label}`],
        };
        setTailoredData(next);
        setEditorSections(plainTextToResumeSections(json.tailoredText));
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
    const text = sectionsToPlainText(editorSections) || tailoredData.tailoredText;
    setDownloadingExport(true);
    setDownloadMenuOpen(false);
    try {
      const res = await fetch(withClientScope("/api/resume/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
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

  async function applyAiPrompt() {
    if (!tailoredData || !aiPrompt.trim() || applyingTweakId) return;
    await applyTweak({ id: "custom", label: aiPrompt.trim() });
    setAiPrompt("");
  }

  function syncSectionsToTailored(nextSections: TailoredResumeSection[]) {
    setEditorSections(nextSections);
    if (tailoredData) {
      setTailoredData({ ...tailoredData, tailoredText: sectionsToPlainText(nextSections) });
    }
  }

  function updateEditorSection(id: string, content: string) {
    syncSectionsToTailored(editorSections.map((s) => (s.id === id ? { ...s, content } : s)));
  }

  function deleteEditorSection(id: string) {
    syncSectionsToTailored(editorSections.filter((s) => s.id !== id));
    if (editingSectionId === id) setEditingSectionId(null);
  }

  async function saveTailoredResume(openApplyAfter = false) {
    if (!tailoredData) return false;
    const text = sectionsToPlainText(editorSections) || tailoredData.tailoredText;
    if (!jobId) {
      onTailorResume();
      return true;
    }
    setCommitting(true);
    setGenerateError(null);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/commit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredText: text,
          sourceAssetId: activeResumeId,
          injectedKeywords: tailoredData.injectedKeywords,
          changes: tailoredData.changes,
          previousScore: data?.score,
          newScore: tailoredData.newScore,
          resumeStyle,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateError((json as { error?: string }).error ?? "Couldn't save tailored resume — try again.");
        return false;
      }
      handleClose();
      onTailorResume();
      if (openApplyAfter && applyUrl) {
        window.open(applyUrl, "_blank", "noopener,noreferrer");
      }
      return true;
    } catch {
      setGenerateError("Couldn't save tailored resume — try again.");
      return false;
    } finally {
      setCommitting(false);
    }
  }

  async function handleApplyNow() {
    await saveTailoredResume(true);
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
    if (hasRequestedAnalysis) {
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
          width: "min(80vw, calc(100vw - 16px))",
          background: RT.drawerBg,
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

        {/* Stepper + wizard title */}
        <div style={{ borderBottom: `1px solid ${RT.border}`, flexShrink: 0, background: RT.panelBg }}>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: 18,
              fontWeight: 700,
              color: RT.text,
              margin: 0,
              padding: "20px 32px 0",
            }}
          >
            Generate Your Custom Resume
          </p>
          <Stepper step={step} />
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: step === 3 && tailoredData ? "hidden" : "auto",
            padding: step === 3 && tailoredData ? 0 : "28px 32px",
            display: step === 3 && tailoredData ? "flex" : "block",
            flexDirection: "column",
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
              {(loading || (hasRequestedAnalysis && !data && !error)) && (
                <KimchiProcessLoader preset="jobMatch" variant="centered" />
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
                        Try again →
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
                      {fallbackNotice && (
                        <p
                          style={{
                            fontFamily: fontSans,
                            fontSize: 13,
                            color: color.muted,
                            padding: "10px 12px",
                            background: "var(--scout-inset)",
                            borderRadius: "var(--scout-radius)",
                            border: "1px solid rgba(0,0,0,0.06)",
                            marginBottom: 16,
                            lineHeight: 1.5,
                          }}
                        >
                          {fallbackNotice}
                        </p>
                      )}
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
                            Match for This Job
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
                          <BigScoreGauge score={data.score} tailor />
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
                            gridTemplateColumns: MATCH_ROW_GRID_SPLIT,
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
                          layout="full"
                          left={
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                              {(data.industryTags ?? data.industries.map((ind) => ({
                                label: ind,
                                matched: data.industryMatch,
                              }))).slice(0, 6).map((ind) => (
                                <IndustryTag key={ind.label} label={ind.label} matched={ind.matched} tailor />
                              ))}
                              {!data.industryMatch && (
                                <span
                                  style={{
                                    fontFamily: fontSans,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#B88A30",
                                  }}
                                >
                                  Limited overlap
                                </span>
                              )}
                            </div>
                          }
                          status={data.industryMatch ? "ok" : "warn"}
                        />
                        <MatchComparisonRow
                          label={`Job Keywords (${matchedKwCount}/${totalKwCount})`}
                          layout="full"
                          left={
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                              {data.keywords.map((kw) => (
                                <MatchKeywordTag key={kw.text} text={kw.text} matched={kw.matched} tailor />
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
                                  marginLeft: 4,
                                }}
                              >
                                {matchedKwCount}/{totalKwCount} matched
                              </span>
                            </div>
                          }
                          status={kwStatus}
                        />
                        <MatchComparisonRow
                          label="Summary"
                          layout="full"
                          left={
                            <span style={{ color: "#52493F", fontStyle: "italic" }}>
                              {data.summaryNote}
                            </span>
                          }
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

              {/* Result — post-generate editor split view */}
              {!aligning && tailoredData && editorSections.length > 0 && (
                <div style={{ display: "flex", gap: 0, height: "100%", minHeight: 480, margin: "-24px -28px" }}>
                  {/* Left: formatted resume preview */}
                  <div
                    style={{
                      flex: "0 0 58%",
                      background: RT.previewBg,
                      padding: "20px 24px",
                      overflowY: "auto",
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        maxWidth: 640,
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: fontSans,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--scout-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.8px",
                        }}
                      >
                        Review Your New Resume
                      </span>
                      {tailoredData.injectedKeywords.length > 0 && (
                        <span
                          style={{
                            fontFamily: fontSans,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#15803D",
                            background: "rgba(134,239,172,0.25)",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          {tailoredData.injectedKeywords.length} keywords added
                        </span>
                      )}
                    </div>
                    <div style={{ width: "100%", maxWidth: 640 }}>
                      <TailoredResumePreview
                        sections={editorSections}
                        highlightKeywords={tailoredData.injectedKeywords}
                        resumeStyle={resumeStyle}
                      />
                    </div>
                  </div>

                  {/* Right: AI Rewrite / Editor / Style panel */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      borderLeft: "1px solid rgba(0,0,0,0.08)",
                      background: "#FFFFFF",
                      minWidth: 0,
                    }}
                  >
                    {/* Tab bar */}
                    <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
                      {(
                        [
                          { id: "ai" as const, label: "AI Rewrite" },
                          { id: "editor" as const, label: "Editor" },
                          { id: "style" as const, label: "Style" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setRightTab(tab.id)}
                          style={{
                            flex: 1,
                            padding: "12px 8px",
                            background: "none",
                            border: "none",
                            borderBottom: rightTab === tab.id ? `2px solid ${RT.green}` : "2px solid transparent",
                            fontFamily: fontSans,
                            fontSize: 13,
                            fontWeight: rightTab === tab.id ? 700 : 500,
                            color: rightTab === tab.id ? "#1A1A1A" : "var(--scout-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: rightTab === "style" ? 0 : "16px 18px" }}>
                      {rightTab === "ai" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          <div
                            style={{
                              background: "var(--scout-inset)",
                              borderRadius: "var(--scout-radius)",
                              padding: "16px",
                              border: "1px solid rgba(0,0,0,0.06)",
                              textAlign: "center",
                            }}
                          >
                            <p
                              style={{
                                fontFamily: fontSans,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "var(--scout-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.8px",
                                marginBottom: 8,
                              }}
                            >
                              Match Score
                            </p>
                            <BigScoreGauge score={tailoredData.newScore} tailor />
                            <p
                              style={{
                                fontFamily: fontSans,
                                fontSize: 13,
                                color: "#52493F",
                                marginTop: 8,
                                marginBottom: 0,
                              }}
                            >
                              Score jumped from{" "}
                              <strong style={{ fontFamily: fontMono }}>
                                {data?.score?.toFixed(1) ?? "–"} → {tailoredData.newScore.toFixed(1)}
                              </strong>
                            </p>
                          </div>

                          <div>
                            <p
                              style={{
                                fontFamily: fontSans,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#1A1A1A",
                                textTransform: "uppercase",
                                letterSpacing: "0.8px",
                                marginBottom: 10,
                              }}
                            >
                              See What&apos;s Changed
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
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
                                  <span style={{ color: "#3D7A5B", fontSize: 14, flexShrink: 0 }}>•</span>
                                  <p style={{ fontFamily: fontSans, fontSize: 13, color: "#1A1A1A", lineHeight: 1.5, margin: 0 }}>
                                    {change}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {tailoredData.tweaks.length > 0 && (
                            <div>
                              <p
                                style={{
                                  fontFamily: fontSans,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "var(--scout-muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.8px",
                                  marginBottom: 8,
                                }}
                              >
                                Quick tweaks
                              </p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {tailoredData.tweaks.map((tweak) => (
                                  <button
                                    key={tweak.id}
                                    type="button"
                                    disabled={!!applyingTweakId}
                                    onClick={() => void applyTweak(tweak)}
                                    style={{
                                      padding: "7px 12px",
                                      background: "#FAFAF9",
                                      border: "1px solid rgba(0,0,0,0.1)",
                                      borderRadius: 999,
                                      fontFamily: fontSans,
                                      fontSize: 12,
                                      color: "#52493F",
                                      cursor: applyingTweakId ? "wait" : "pointer",
                                      textAlign: "left",
                                    }}
                                  >
                                    {applyingTweakId === tweak.id ? "Applying…" : `${tweak.label} →`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ marginTop: "auto" }}>
                            <textarea
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="Tell me how you'd like to tweak your resume…"
                              rows={3}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "1px solid rgba(0,0,0,0.12)",
                                borderRadius: "var(--scout-radius)",
                                fontFamily: fontSans,
                                fontSize: 13,
                                resize: "vertical",
                                boxSizing: "border-box",
                                marginBottom: 8,
                              }}
                            />
                            <button
                              type="button"
                              disabled={!aiPrompt.trim() || !!applyingTweakId}
                              onClick={() => void applyAiPrompt()}
                              style={{
                                width: "100%",
                                padding: "11px",
                                ...(aiPrompt.trim() && !applyingTweakId ? scoutPrimaryCtaStyle : {
                                  background: "rgba(0,0,0,0.05)",
                                  color: "var(--scout-muted)",
                                  border: "none",
                                }),
                                borderRadius: "var(--scout-radius)",
                                fontFamily: fontSans,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: aiPrompt.trim() && !applyingTweakId ? "pointer" : "not-allowed",
                              }}
                            >
                              {applyingTweakId ? "Applying…" : "Edit With AI ✦"}
                            </button>
                          </div>
                        </div>
                      )}

                      {rightTab === "editor" && (
                        <div>
                          <p
                            style={{
                              fontFamily: fontSans,
                              fontSize: 12,
                              color: "#52493F",
                              background: "rgba(74,139,106,0.08)",
                              padding: "10px 12px",
                              borderRadius: "var(--scout-radius)",
                              lineHeight: 1.5,
                              marginBottom: 14,
                            }}
                          >
                            Edits here apply only to this job&apos;s resume. Update your base resume in Profile for changes that carry across roles.
                          </p>
                          {editorSections.map((section) => (
                            <div key={section.id} style={{ marginBottom: 8 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 0",
                                  borderBottom: editingSectionId === section.id ? "1px solid rgba(0,0,0,0.08)" : "none",
                                }}
                              >
                                <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
                                  {section.title}
                                </span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingSectionId === section.id) {
                                        setEditingSectionId(null);
                                      } else {
                                        setEditingSectionId(section.id);
                                        setSectionDraft(section.content);
                                      }
                                    }}
                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--scout-muted)" }}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  {section.type !== "header" && (
                                    <button
                                      type="button"
                                      onClick={() => deleteEditorSection(section.id)}
                                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--scout-muted)" }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {editingSectionId === section.id && (
                                <textarea
                                  value={sectionDraft}
                                  onChange={(e) => setSectionDraft(e.target.value)}
                                  onBlur={() => {
                                    updateEditorSection(section.id, sectionDraft);
                                    setEditingSectionId(null);
                                  }}
                                  rows={5}
                                  style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    borderRadius: "var(--scout-radius)",
                                    fontFamily: fontSans,
                                    fontSize: 13,
                                    resize: "vertical",
                                    boxSizing: "border-box",
                                    marginTop: 4,
                                  }}
                                />
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newSec: TailoredResumeSection = {
                                id: `s-${Date.now()}`,
                                title: "New Section",
                                type: "text",
                                content: "",
                              };
                              syncSectionsToTailored([...editorSections, newSec]);
                              setEditingSectionId(newSec.id);
                              setSectionDraft("");
                            }}
                            style={{
                              width: "100%",
                              padding: "8px",
                              marginTop: 8,
                              background: "transparent",
                              border: "1px dashed rgba(0,0,0,0.15)",
                              borderRadius: "var(--scout-radius)",
                              fontFamily: fontSans,
                              fontSize: 13,
                              color: "#52493F",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <Plus size={13} /> Add section
                          </button>
                        </div>
                      )}

                      {rightTab === "style" && (
                        <ResumeStylePanel
                          style={resumeStyle}
                          onChange={(next) => setResumeStyle(normalizeResumeStyle(next))}
                          compact
                          useTailorTokens
                        />
                      )}
                    </div>
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
              borderTop: `1px solid ${RT.border}`,
              flexShrink: 0,
              background: RT.panelBg,
            }}
          >
            <button
              type="button"
              onClick={handleAlign}
              style={{
                width: "100%",
                padding: "15px",
                background: RT.green,
                color: RT.text,
                border: "none",
                borderRadius: RT.ctaPrimaryRadius,
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.3px",
              }}
            >
              Improve My Resume for This Job →
            </button>
          </div>
        )}

        {step === 2 && (
          <div
            style={{
              padding: "16px 32px",
              borderTop: `1px solid ${RT.border}`,
              flexShrink: 0,
              background: RT.panelBg,
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
                color: RT.muted,
                border: `1px solid ${RT.border}`,
                borderRadius: RT.ctaSecondaryRadius,
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
                background: selectedSections.size > 0 ? RT.green : RT.stepInactive,
                color: RT.text,
                border: "none",
                borderRadius: RT.ctaPrimaryRadius,
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 700,
                cursor: selectedSections.size > 0 ? "pointer" : "not-allowed",
                letterSpacing: "0.3px",
              }}
            >
              Generate My New Resume →
            </button>
          </div>
        )}

        {step === 3 && !aligning && tailoredData && editorSections.length > 0 && (
          <div
            style={{
              position: "relative",
              padding: "16px 32px",
              borderTop: `1px solid ${RT.border}`,
              flexShrink: 0,
              background: RT.panelBg,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={committing}
              style={{
                padding: "14px 20px",
                background: "transparent",
                color: RT.muted,
                border: `1px solid ${RT.border}`,
                borderRadius: RT.ctaSecondaryRadius,
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 500,
                cursor: committing ? "default" : "pointer",
                flexShrink: 0,
              }}
            >
              ← Back
            </button>
            <div ref={downloadRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setDownloadMenuOpen((v) => !v)}
                disabled={downloadingExport || committing}
                style={{
                  padding: "14px 20px",
                  background: "transparent",
                  color: RT.text,
                  border: `1px solid ${RT.border}`,
                  borderRadius: RT.ctaSecondaryRadius,
                  fontFamily: fontSans,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: downloadingExport ? "wait" : "pointer",
                }}
              >
                {downloadingExport ? "Downloading…" : "Download Resume"}
              </button>
              {downloadMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: "calc(100% + 6px)",
                    background: RT.panelBg,
                    border: `1px solid ${RT.border}`,
                    borderRadius: RT.ctaSecondaryRadius,
                    minWidth: 180,
                    zIndex: 5,
                    overflow: "hidden",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  }}
                >
                  <button type="button" onClick={() => void exportResume("pdf")} style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: "none", border: "none", fontFamily: fontSans, fontSize: 13, cursor: "pointer" }}>Download PDF</button>
                  <button type="button" onClick={() => void exportResume("docx")} style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: "none", border: "none", fontFamily: fontSans, fontSize: 13, cursor: "pointer", borderTop: `1px solid ${RT.border}` }}>Download Word</button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleApplyNow()}
              disabled={committing || downloadingExport}
              style={{
                flex: 1,
                padding: "14px 20px",
                background: RT.applyBg,
                color: "#FFFFFF",
                border: "none",
                borderRadius: RT.ctaPrimaryRadius,
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 700,
                cursor: committing ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                letterSpacing: "0.3px",
              }}
            >
              {committing ? "Saving…" : (
                <>
                  Apply Now
                  <Zap size={16} fill={RT.applyIcon} color={RT.applyIcon} />
                </>
              )}
            </button>
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
