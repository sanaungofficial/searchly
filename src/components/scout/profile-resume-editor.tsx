"use client";

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { X, Download, Loader2, Check, RefreshCw, Share2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type ParsedResumeData,
  emptyParsedResumeData,
  resumeCompleteness,
  hasResumeBodyContent,
  type ResumeSectionId,
} from "@/lib/resume-parse";
import { JR, type ReportIssue } from "./profile-resume-editor-panels";
import {
  ResumeAnalysisReportDrawer,
  buildFullReport,
  scoreToGrade,
  type ReportHighlightCategory,
} from "./profile-resume-analysis-report";
import { JobrightResumeDocument, JobrightScorePill } from "./profile-resume-jobright-document";
import { ResumeMatchPanel } from "./profile-resume-match-panel";
import { getSectionFixIssues, ResumeSectionFixDrawer } from "./profile-resume-section-fix-drawer";
import {
  computeExperienceEntryMatches,
  computeSectionMatches,
  type JobMatchResult,
} from "@/lib/resume-match";

interface ProfileResumeEditorProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  initialJobDescription?: string | null;
  autoRunMatch?: boolean;
  onboardingJobLabel?: string | null;
}

interface AssetResponse {
  id: string;
  name: string;
  isPrimary: boolean;
  parsedData: ParsedResumeData | null;
  profileName?: string | null;
  profileEmail?: string | null;
}

interface AnalysisData {
  score?: number;
  headline?: string;
  strengths?: string[];
  gaps?: string[];
  tips?: string[];
  improvements?: { priority: string; title: string; detail: string }[];
  highlights?: ReportHighlightCategory[];
  _cachedAt?: string;
  error?: string;
}

function normalizeAnalysis(raw: AnalysisData): { score?: number; headline?: string; strengths?: string[]; issues: ReportIssue[] } {
  const issues: ReportIssue[] = [];
  if (raw.improvements?.length) {
    for (const imp of raw.improvements) {
      issues.push({
        priority: imp.priority === "Urgent" || imp.priority === "Critical" || imp.priority === "Optional" ? imp.priority : "Optional",
        title: imp.title,
        detail: imp.detail,
      });
    }
  } else {
    (raw.gaps || []).forEach((gap, i) => {
      issues.push({
        priority: i === 0 ? "Urgent" : i === 1 ? "Critical" : "Optional",
        title: gap,
        detail: raw.tips?.[i] || "",
      });
    });
    (raw.tips || []).slice((raw.gaps || []).length).forEach((tip) => {
      issues.push({ priority: "Optional", title: "Improvement", detail: tip });
    });
  }
  return { score: raw.score, headline: raw.headline, strengths: raw.strengths, issues };
}

export function ProfileResumeEditor({
  open,
  assetId,
  onClose,
  onUpdated,
  initialJobDescription,
  autoRunMatch = false,
  onboardingJobLabel,
}: ProfileResumeEditorProps) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResumeData>(emptyParsedResumeData());
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [fixSection, setFixSection] = useState<{ sectionId: ResumeSectionId; entryLabel?: string; mode?: "all" | "impact" } | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchPanelOpen, setMatchPanelOpen] = useState(true);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoMatch = useRef(false);
  const autoMatchStarted = useRef(false);

  useLayoutEffect(() => {
    setVisible(!!open);
  }, [open]);

  const completeness = resumeCompleteness(parsedData);
  const report = analysis && !analysis.error ? normalizeAnalysis(analysis) : null;
  const reportIssues: ReportIssue[] = report?.issues || completeness.missing.map((m, i) => ({
    priority: i === 0 ? "Urgent" : i === 1 ? "Critical" : "Optional",
    title: `Missing ${m}`,
    detail: `Add ${m.toLowerCase()} to strengthen your resume.`,
  }));

  const fullReport = buildFullReport({
    score: report?.score ?? completeness.pct,
    headline: report?.headline,
    strengths: report?.strengths,
    issues: reportIssues,
    highlights: analysis?.highlights,
    updatedAt: analysis?._cachedAt,
  });

  function beginImprovements() {
    setReportOpen(false);
    const firstUrgent = fullReport.highlights
      .flatMap((g) => g.items)
      .find((i) => i.severity === "Urgent" || i.severity === "Critical");
    const title = firstUrgent?.title.toLowerCase() || "";
    if (/summary|skill|keyword/.test(title)) setFixSection({ sectionId: "summary", mode: "all" });
    else if (/education|degree/.test(title)) setFixSection({ sectionId: "education", mode: "all" });
    else if (/skill/.test(title)) setFixSection({ sectionId: "skills", mode: "all" });
    else setFixSection({ sectionId: "experience", mode: "all" });
  }

  const displayScore = report?.score ?? completeness.pct;
  const { grade, label: gradeLabel } = scoreToGrade(displayScore);
  const fixIssues = fixSection ? getSectionFixIssues(fixSection.sectionId, fullReport, fixSection.mode ?? "all") : [];
  const sectionMatches = matchResult?.keywords?.length ? computeSectionMatches(parsedData, matchResult.keywords) : {};
  const entryMatches = matchResult?.keywords?.length ? computeExperienceEntryMatches(parsedData, matchResult.keywords) : {};

  const loadAnalysis = useCallback(async (id: string, force = false) => {
    setAnalysisLoading(true);
    try {
      const url = force ? `/api/assets/${id}/analysis?force=true` : `/api/assets/${id}/analysis`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setAnalysis(data);
      else setAnalysis({ error: data.error || "Analysis unavailable on dev — needs production AI key" });
    } catch {
      setAnalysis({ error: "Could not load analysis" });
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const saveParsedData = useCallback(async (updated: ParsedResumeData) => {
    if (!assetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedData: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setParsedData(data.asset?.parsedData ?? updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onUpdated?.();
      }
    } finally {
      setSaving(false);
    }
  }, [assetId, onUpdated]);

  const queueSave = useCallback((next: ParsedResumeData) => {
    setParsedData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveParsedData(next), 600);
  }, [saveParsedData]);

  const runMatchAnalysis = useCallback(async () => {
    if (!assetId || !jobDescription.trim()) return;
    setMatchLoading(true);
    setMatchError(null);
    try {
      localStorage.setItem(`resume-match-jd-${assetId}`, jobDescription);
      const res = await fetch(`/api/assets/${assetId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: jobDescription }),
      });
      const data = await res.json();
      if (res.ok) setMatchResult(data as JobMatchResult);
      else setMatchError(data.error || "Match analysis failed");
    } catch {
      setMatchError("Could not run match analysis");
    } finally {
      setMatchLoading(false);
    }
  }, [assetId, jobDescription]);

  const shareResume = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: assetName || "Resume", url });
        setShareMsg("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link copied");
      } else {
        setShareMsg("Copy URL from address bar");
      }
    } catch {
      setShareMsg(null);
      return;
    }
    setTimeout(() => setShareMsg(null), 2000);
  }, [assetName]);

  const loadAsset = useCallback(async (id: string) => {
    setLoading(true);
    setParseError(null);
    try {
      const res = await fetch(`/api/assets/${id}`);
      if (!res.ok) return;
      const data: AssetResponse = await res.json();
      setAssetName(data.name || "Resume");
      setIsPrimary(!!data.isPrimary);

      let pd = data.parsedData ?? emptyParsedResumeData();
      if (!pd.name && data.profileName) pd = { ...pd, name: data.profileName };
      if (!pd.email && data.profileEmail) pd = { ...pd, email: data.profileEmail };

      let parseErr: string | null = null;
      if (!hasResumeBodyContent(pd)) {
        setReparsing(true);
        try {
          const reparseRes = await fetch(`/api/assets/${id}/reparse`, { method: "POST" });
          const reparseData = await reparseRes.json();
          if (reparseRes.ok && reparseData.parsedData) pd = reparseData.parsedData;
          else if (!reparseRes.ok) parseErr = reparseData.error || "Could not parse resume structure";
        } finally {
          setReparsing(false);
        }
      }

      setParsedData(pd);
      if (!hasResumeBodyContent(pd)) {
        setParseError(parseErr || "Could not extract resume sections. Try re-uploading your PDF or DOCX, or use Retry.");
      }
      const savedJd = localStorage.getItem(`resume-match-jd-${id}`);
      if (savedJd) setJobDescription(savedJd);
      loadAnalysis(id);
    } finally {
      setLoading(false);
    }
  }, [loadAnalysis]);

  useEffect(() => {
    if (open && assetId) loadAsset(assetId);
    if (!open) {
      setAnalysis(null);
      setReportOpen(false);
      setFixSection(null);
      setMatchResult(null);
      setMatchError(null);
      setJobDescription("");
      setShareMsg(null);
      pendingAutoMatch.current = false;
      autoMatchStarted.current = false;
    }
  }, [open, assetId, loadAsset]);

  useEffect(() => {
    if (!open || loading || !initialJobDescription?.trim()) return;
    setJobDescription(initialJobDescription);
    setMatchPanelOpen(true);
    if (autoRunMatch) pendingAutoMatch.current = true;
  }, [open, loading, initialJobDescription, autoRunMatch]);

  useEffect(() => {
    if (!open || !assetId || !pendingAutoMatch.current || autoMatchStarted.current) return;
    if (!jobDescription.trim() || matchLoading || loading) return;
    autoMatchStarted.current = true;
    pendingAutoMatch.current = false;
    void runMatchAnalysis();
  }, [open, assetId, jobDescription, matchLoading, loading, runMatchAnalysis]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  if (!open) return null;

  async function downloadDocx() {
    if (!assetId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/download?format=docx`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${assetName || "resume"}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="resume-print-outer" style={{ position: "fixed", inset: 0, zIndex: 1000, fontFamily: "var(--font-ui), sans-serif" }}>
      <div className="resume-print-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.35)", opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }} />
      <div className="resume-print-target" style={{ position: "absolute", top: isMobile ? 0 : 8, right: isMobile ? 0 : 8, bottom: isMobile ? 0 : 8, left: isMobile ? 0 : undefined, width: isMobile ? "100vw" : "min(94vw, calc(100vw - 16px))", background: JR.bg, borderRadius: isMobile ? 0 : 14, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: isMobile ? "none" : "0 12px 48px rgba(0,0,0,0.18)", transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))", transition: "transform 0.25s ease" }}>
        <div className="resume-print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 12px" : "0 20px", height: 52, borderBottom: `1px solid ${JR.border}`, background: JR.panel, flexShrink: 0, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: JR.muted, display: "flex" }}><X size={18} /></button>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: JR.muted }}>RESUME</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: JR.text, padding: "4px 10px", background: JR.bg, borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{assetName}</span>
            {isPrimary && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", background: JR.greenLight, color: JR.greenDark, borderRadius: 999 }}>Primary</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <JobrightScorePill score={displayScore} grade={grade} gradeLabel={gradeLabel} onViewReport={() => setReportOpen(true)} />
            {saved && <span style={{ fontSize: 13, color: JR.green, display: "flex", alignItems: "center", gap: 4 }}><Check size={13} /> Saved</span>}
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: JR.muted }} />}
            <button type="button" onClick={shareResume} style={{ padding: "7px 12px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Share2 size={14} /> Share</button>
            {shareMsg && <span style={{ fontSize: 12, color: JR.green }}>{shareMsg}</span>}
            <button type="button" onClick={() => window.print()} style={{ padding: "7px 12px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Preview</button>
            <button type="button" onClick={downloadDocx} disabled={downloading} style={{ padding: "7px 14px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {downloading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />} Download
            </button>
          </div>
        </div>
        {onboardingJobLabel && (
          <div className="resume-print-hide" style={{ padding: "10px 16px", background: "rgba(26,58,47,0.06)", borderBottom: `1px solid ${JR.border}` }}>
            <p style={{ fontSize: 13, color: JR.text, margin: 0, lineHeight: 1.5 }}>
              Welcome — here&apos;s your base resume matched against{" "}
              <strong>{onboardingJobLabel}</strong>. Improve sections on the left; your job is saved in Pipeline.
            </p>
          </div>
        )}
        {parseError && !loading && !reparsing && (
          <div className="resume-print-hide" style={{ padding: "10px 16px", background: JR.criticalBg, borderBottom: `1px solid ${JR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, color: JR.text }}>{parseError}</span>
            <button type="button" onClick={() => assetId && loadAsset(assetId)} style={{ padding: "6px 12px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={12} /> Retry</button>
          </div>
        )}
        <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
          <div className="resume-print-center" style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px" : "24px 32px", display: "flex", flexDirection: "column", alignItems: "center", background: JR.bg }}>
            {loading || reparsing ? (
              <div style={{ marginTop: 80, textAlign: "center", color: JR.muted }}>
                <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
                <p style={{ fontSize: 14 }}>{reparsing ? "Parsing resume structure…" : "Loading resume…"}</p>
              </div>
            ) : (
              <JobrightResumeDocument data={parsedData} onChange={queueSave} onFixSection={(sectionId, entryLabel) => setFixSection({ sectionId, entryLabel, mode: "all" })} onImpactSection={(sectionId, entryLabel) => setFixSection({ sectionId, entryLabel, mode: "impact" })} onOpenAiAnalysis={() => setReportOpen(true)} score={displayScore} grade={grade} gradeLabel={gradeLabel} onViewReport={() => setReportOpen(true)} sectionMatches={sectionMatches} entryMatches={entryMatches} />
            )}
          </div>
          {!isMobile && (matchPanelOpen ? (
            <ResumeMatchPanel jobDescription={jobDescription} onJobDescriptionChange={setJobDescription} onRunMatch={runMatchAnalysis} loading={matchLoading} result={matchResult} error={matchError} onToggle={() => setMatchPanelOpen(false)} />
          ) : (
            <ResumeMatchPanel jobDescription={jobDescription} onJobDescriptionChange={setJobDescription} onRunMatch={runMatchAnalysis} loading={matchLoading} result={matchResult} error={matchError} collapsed onToggle={() => setMatchPanelOpen(true)} />
          ))}
        </div>
        {isMobile && (
          <div className="resume-print-hide">
            <ResumeMatchPanel jobDescription={jobDescription} onJobDescriptionChange={setJobDescription} onRunMatch={runMatchAnalysis} loading={matchLoading} result={matchResult} error={matchError} embedded />
          </div>
        )}
        <ResumeAnalysisReportDrawer open={reportOpen} onClose={() => setReportOpen(false)} report={fullReport} loading={analysisLoading} error={analysisLoading ? undefined : analysis?.error && !reportIssues.length ? analysis.error : undefined} onBeginImprovements={beginImprovements} onRefresh={() => assetId && loadAnalysis(assetId, true)} aiUnavailable={!!analysis?.error && reportIssues.length > 0} />
        <ResumeSectionFixDrawer open={!!fixSection} sectionId={fixSection?.sectionId ?? null} entryLabel={fixSection?.entryLabel} issues={fixIssues} onClose={() => setFixSection(null)} />
        <style>{`@media print { body > *:not(.resume-print-outer) { display: none !important; } .resume-print-outer { position: static !important; display: block !important; } .resume-print-backdrop, .resume-print-hide { display: none !important; } .resume-print-target { position: static !important; width: 100% !important; height: auto !important; box-shadow: none !important; border-radius: 0 !important; transform: none !important; } .resume-print-center { padding: 0 !important; overflow: visible !important; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
