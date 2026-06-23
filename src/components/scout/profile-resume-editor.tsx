"use client";

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { X, Download, Loader2, Check, Printer, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type ParsedResumeData,
  emptyParsedResumeData,
  resumeCompleteness,
  hasResumeBodyContent,
  type ResumeSectionId,
} from "@/lib/resume-parse";
import {
  JR,
  ReportPanel,
  ResumePreview,
  SectionsPanel,
  type ReportIssue,
} from "./profile-resume-editor-panels";

interface ProfileResumeEditorProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
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

export function ProfileResumeEditor({ open, assetId, onClose, onUpdated }: ProfileResumeEditorProps) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResumeData>(emptyParsedResumeData());
  const [activeSection, setActiveSection] = useState<ResumeSectionId>("experience");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [mobileTab, setMobileTab] = useState<"report" | "preview" | "edit">("preview");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setParseError(parseErr || "Resume sections are empty. Use the editor panel to add content.");
      }
      loadAnalysis(id);
    } finally {
      setLoading(false);
    }
  }, [loadAnalysis]);

  useEffect(() => {
    if (open && assetId) loadAsset(assetId);
    if (!open) {
      setAnalysis(null);
      setMobileTab("preview");
    }
  }, [open, assetId, loadAsset]);

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

  const headerFields = (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
      {[
        { key: "name", label: "Full name", value: parsedData.name || "" },
        { key: "email", label: "Email", value: parsedData.email || "" },
        { key: "phone", label: "Phone", value: parsedData.phone || "" },
        { key: "location", label: "Location", value: parsedData.location || "" },
        { key: "linkedinUrl", label: "LinkedIn", value: parsedData.linkedinUrl || "" },
        { key: "website", label: "Website", value: parsedData.website || "" },
      ].map((field) => (
        <input
          key={field.key}
          placeholder={field.label}
          value={field.value}
          onChange={(e) => queueSave({ ...parsedData, [field.key]: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${JR.border}`,
            borderRadius: 6,
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="resume-print-outer" style={{ position: "fixed", inset: 0, zIndex: 1000, fontFamily: "var(--font-ui), sans-serif" }}>
      <div
        className="resume-print-backdrop"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.35)", opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}
      />
      <div
        className="resume-print-target"
        style={{
          position: "absolute",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : "min(94vw, calc(100vw - 16px))",
          background: JR.bg,
          borderRadius: isMobile ? 0 : 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: isMobile ? "none" : "0 12px 48px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
        }}
      >
        <div
          className="resume-print-hide"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 12px" : "0 24px",
            height: 56,
            borderBottom: `1px solid ${JR.border}`,
            background: JR.panel,
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: JR.muted, display: "flex" }}>
              <X size={18} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: JR.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assetName}</span>
            {isPrimary && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", background: JR.greenLight, color: JR.greenDark, borderRadius: 999 }}>Primary</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saved && <span style={{ fontSize: 13, color: JR.green, display: "flex", alignItems: "center", gap: 4 }}><Check size={13} /> Saved</span>}
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: JR.muted }} />}
            <button type="button" onClick={() => window.print()} style={{ padding: "8px 14px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Printer size={14} /> Print
            </button>
            <button type="button" onClick={downloadDocx} disabled={downloading} style={{ padding: "8px 16px", background: JR.green, color: "#FFF", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {downloading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
              Export
            </button>
          </div>
        </div>

        {isMobile && (
          <div className="resume-print-hide" style={{ display: "flex", borderBottom: `1px solid ${JR.border}`, background: JR.panel }}>
            {(["report", "preview", "edit"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: mobileTab === tab ? JR.greenLight : "transparent",
                  border: "none",
                  borderBottom: mobileTab === tab ? `2px solid ${JR.green}` : "2px solid transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  color: mobileTab === tab ? JR.greenDark : JR.muted,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {parseError && !loading && !reparsing && (
          <div className="resume-print-hide" style={{ padding: "10px 16px", background: JR.criticalBg, borderBottom: `1px solid ${JR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, color: JR.text }}>{parseError}</span>
            <button type="button" onClick={() => assetId && loadAsset(assetId)} style={{ padding: "6px 12px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {(!isMobile || mobileTab === "report") && (
            <div className="resume-print-hide" style={{ width: isMobile ? "100%" : 300, flexShrink: 0, borderRight: isMobile ? "none" : `1px solid ${JR.border}` }}>
              <ReportPanel
                completenessPct={completeness.pct}
                missing={completeness.missing}
                score={report?.score}
                headline={report?.headline}
                strengths={report?.strengths}
                issues={reportIssues}
                loading={analysisLoading}
                error={analysis?.error}
                onRefresh={() => assetId && loadAnalysis(assetId, true)}
              />
            </div>
          )}

          {(!isMobile || mobileTab === "preview") && (
            <div
              className="resume-print-center"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: isMobile ? "16px 12px" : "24px 32px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: JR.bg,
              }}
            >
              {loading || reparsing ? (
                <div style={{ marginTop: 80, textAlign: "center", color: JR.muted }}>
                  <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
                  <p style={{ fontSize: 14 }}>{reparsing ? "Parsing resume structure…" : "Loading resume…"}</p>
                </div>
              ) : (
                <>
                  <div className="resume-print-hide" style={{ width: "100%", maxWidth: 720, marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: JR.muted }}>Contact</p>
                    {headerFields}
                  </div>
                  <ResumePreview data={parsedData} />
                </>
              )}
            </div>
          )}

          {(!isMobile || mobileTab === "edit") && (
            <div className="resume-print-hide" style={{ width: isMobile ? "100%" : 320, flexShrink: 0 }}>
              <SectionsPanel
                data={parsedData}
                activeSection={activeSection}
                onActiveSection={setActiveSection}
                onChange={queueSave}
              />
            </div>
          )}
        </div>

        <style>{`
          @media print {
            body > *:not(.resume-print-outer) { display: none !important; }
            .resume-print-outer { position: static !important; display: block !important; }
            .resume-print-backdrop, .resume-print-hide { display: none !important; }
            .resume-print-target { position: static !important; width: 100% !important; height: auto !important; box-shadow: none !important; border-radius: 0 !important; transform: none !important; }
            .resume-print-center { padding: 0 !important; overflow: visible !important; }
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
