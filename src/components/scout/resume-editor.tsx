"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Trash2, Plus, Download, RefreshCw, Loader2, Check, ChevronDown } from "lucide-react";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { notifyCreditsChanged } from "@/lib/credits";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoreExplainerPopover } from "./score-explainer-popover";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { ResumeStylePanel } from "./resume-style-panel";
import { fontSans, fontMono } from "@/lib/typography";
import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  resumeStyleToCss,
  type ResumeStyleSettings,
} from "@/lib/resume-style";

interface ResumeSection {
  id: string;
  title: string;
  type: "text" | "bullets" | "header";
  content: string;
}

interface ResumeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle?: string;
  company?: string;
  updatedAt?: string;
}

export function ResumeEditor({ open, onOpenChange, jobId, jobTitle, company, updatedAt: updatedAtProp }: ResumeEditorProps) {
  const router = useRouter();
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [previewSections, setPreviewSections] = useState<ResumeSection[] | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [fitToPage, setFitToPage] = useState(false);
  const [resumeStyle, setResumeStyle] = useState<ResumeStyleSettings>(DEFAULT_RESUME_STYLE);
  const [rightTab, setRightTab] = useState<"sections" | "style">("sections");
  const [matchData, setMatchData] = useState<{ score: number; matched: string[]; missing: string[]; total: number } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(updatedAtProp ?? null);
  const [stale, setStale] = useState(false);
  const { openPricing, withClientScope } = useWorkspace();
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && jobId) {
      setLoading(true);
      setMatchData(null);
      setStale(false);
      fetch(withClientScope(`/api/resume/tailored/${jobId}`))
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.sections)) setSections(d.sections);
          if (d.updatedAt) setLastUpdated(d.updatedAt);
          if (d.stale) setStale(true);
          if (d.resumeStyle) setResumeStyle(normalizeResumeStyle(d.resumeStyle));
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      setMatchLoading(true);
      fetch(withClientScope(`/api/resume/tailored/${jobId}/match`))
        .then((r) => r.json())
        .then((d) => { if (typeof d.score === "number") setMatchData(d); })
        .catch(() => {})
        .finally(() => setMatchLoading(false));
    }
  }, [open, jobId]);

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

  if (!open) return null;

  const activeSections = previewSections ?? sections;
  const style = normalizeResumeStyle(resumeStyle);
  const styleCss = resumeStyleToCss(style);
  const compactPreview = fitToPage || style.fitToOnePage;
  const bulletPrefix = style.bulletStyle === "dash" ? "– " : "• ";

  async function save(updated: ResumeSection[], styleOverride?: ResumeStyleSettings) {
    setSaving(true);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: updated,
          resumeStyle: styleOverride ?? resumeStyle,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.updatedAt) setLastUpdated(d.updatedAt);
      setStale(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function updateResumeStyle(next: ResumeStyleSettings) {
    setResumeStyle(next);
    if (sections.length) save(sections, next);
  }

  function updateSection(id: string, content: string) {
    const updated = sections.map((s) => s.id === id ? { ...s, content } : s);
    setSections(updated);
    save(updated);
  }

  function deleteSection(id: string) {
    const updated = sections.filter((s) => s.id !== id);
    setSections(updated);
    save(updated);
    if (editingId === id) setEditingId(null);
  }

  function addSection() {
    const newSection: ResumeSection = {
      id: `s-${Date.now()}`,
      title: "New Section",
      type: "text",
      content: "",
    };
    const updated = [...sections, newSection];
    setSections(updated);
    setEditingId(newSection.id);
    save(updated);
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/regenerate`), { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setPreviewSections(d.sections);
      }
    } finally {
      setRegenerating(false);
    }
  }

  function acceptRegenerate() {
    if (!previewSections) return;
    setSections(previewSections);
    save(previewSections);
    setPreviewSections(null);
    setMatchLoading(true);
      fetch(withClientScope(`/api/resume/tailored/${jobId}/match`))
      .then((r) => r.json())
      .then((d) => { if (typeof d.score === "number") setMatchData(d); })
      .catch(() => {})
      .finally(() => setMatchLoading(false));
  }

  async function downloadDocx() {
    setDownloading(true);
    setDownloadMenuOpen(false);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/download?format=docx`));
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resume-${company || "tailored"}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function downloadPdf() {
    setDownloadMenuOpen(false);
    setDownloading(true);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/download?format=pdf`));
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resume-${company || "tailored"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } finally {
      setDownloading(false);
    }
    window.print();
  }

  function editBaseResume() {
    onOpenChange(false);
    router.push("/profile/assets");
  }

  function formatUpdatedAt(iso: string | null) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return null;
    }
  }

  const personalInfo = activeSections.find((s) => s.type === "header");
  const contentSections = activeSections.filter((s) => s.type !== "header");

  return (
    <div
      className="resume-print-outer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-ui), sans-serif",
      }}
    >
      {/* Backdrop */}
      <div
        className="resume-print-backdrop"
        onClick={() => onOpenChange(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }}
      />
    <div
      className="resume-print-target"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 1200,
        height: "90vh",
        background: "var(--scout-inset)",
        borderRadius: "var(--scout-radius)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header bar */}
      <div
        className="resume-print-hide"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 56,
          borderBottom: "1px solid #E5DDD0",
          background: "#FDFAF5",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => onOpenChange(false)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--scout-radius)", color: "#52493F" }}
          >
            <X size={16} />
          </button>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>Tailored resume for this role</span>
            {formatUpdatedAt(lastUpdated) && (
              <span style={{ fontSize: 14, color: "var(--scout-muted)", marginLeft: 10 }}>
                Last updated {formatUpdatedAt(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && (
            <span style={{ fontSize: 14, color: "#1A3A2F", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={13} /> Saved
            </span>
          )}
          <button
            onClick={() => setFitToPage(!fitToPage)}
            style={{
              padding: "6px 14px",
              background: fitToPage ? "#1C3A2F" : "#F5F3EF",
              color: fitToPage ? "#E8D5A3" : "#52493F",
              border: "1px solid #D8D0C5",
              borderRadius: "var(--scout-radius)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Fit to one page
          </button>
          <button
            onClick={editBaseResume}
            style={{
              padding: "6px 14px",
              background: "#FFFFFF",
              color: "#52493F",
              border: "1px solid #D8D0C5",
              borderRadius: "var(--scout-radius)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Edit master resume
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left — job context */}
        <div
          className="resume-print-hide"
          style={{
            width: 260,
            borderRight: "1px solid #E5DDD0",
            padding: "28px 24px",
            overflowY: "auto",
            flexShrink: 0,
            background: "#FDFAF5",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <CreditsStatusBar onUpgrade={openPricing} />
          </div>
          {company && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: "var(--scout-radius)", background: "#1C3A2F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ color: "#E8D5A3", fontSize: 16, fontWeight: 700 }}>{company[0]}</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{company}</p>
              {jobTitle && <p style={{ fontSize: 14, color: "#6B6258", marginTop: 3 }}>{jobTitle}</p>}
            </div>
          )}
          {/* Match score */}
          <div style={{ marginBottom: 16 }}>
            {matchLoading ? (
              <div style={{ padding: "14px 16px", background: "#F5F3EF", borderRadius: "var(--scout-radius)", display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 size={13} style={{ color: "var(--scout-muted)", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 14, color: "#7A6E64" }}>Analyzing keyword match…</span>
              </div>
            ) : matchData ? (
              <div style={{ padding: "14px 16px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: "var(--scout-radius)" }}>
                {/* Score header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#52493F", textTransform: "uppercase", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Keyword Match
                    <ScoreExplainerPopover variant="keyword-match" />
                  </span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: matchData.score >= 70 ? "#2E7D52" : matchData.score >= 40 ? "#B8860B" : "#C0392B",
                  }}>
                    {matchData.score}%
                  </span>
                </div>
                {/* Score bar */}
                <div style={{ height: 5, background: "#F0EDE8", borderRadius: "var(--scout-radius)", marginBottom: 12, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${matchData.score}%`,
                    background: matchData.score >= 70 ? "#2E7D52" : matchData.score >= 40 ? "#D4A017" : "#C0392B",
                    borderRadius: "var(--scout-radius)",
                    transition: "width 0.4s ease",
                  }} />
                </div>
                {/* Missing keywords */}
                {matchData.missing.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>
                      Missing ({matchData.missing.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {matchData.missing.map((kw) => (
                        <span key={kw} style={{
                          fontSize: 13,
                          padding: "2px 7px",
                          background: "#FFF0EE",
                          color: "#C0392B",
                          border: "1px solid #FADADD",
                          borderRadius: "var(--scout-radius)",
                        }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Matched keywords */}
                {matchData.matched.length > 0 && (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>
                      Matched ({matchData.matched.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {matchData.matched.map((kw) => (
                        <span key={kw} style={{
                          fontSize: 13,
                          padding: "2px 7px",
                          background: "#F0FAF4",
                          color: "#2E7D52",
                          border: "1px solid #C8E6D0",
                          borderRadius: "var(--scout-radius)",
                        }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {matchData.missing.length > 0 && (
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                    Tip: Regenerate to incorporate missing keywords.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {stale && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                background: "#FFF8F0",
                border: "1px solid #F0E8D8",
                borderRadius: "var(--scout-radius)",
                fontSize: 13,
                color: "#7A6E64",
                lineHeight: 1.55,
              }}
            >
              Your master resume changed since this draft was saved. Regenerate from the job drawer to refresh for this role.
            </div>
          )}

          <div
            style={{
              padding: "14px 16px",
              background: "#FFF8F0",
              border: "1px solid #F0E8D8",
              borderRadius: "var(--scout-radius)",
              fontSize: 14,
              color: "#7A6E64",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#C0392B", marginRight: 4 }}>⚠</span>
            Section edits here apply only to this job. Update your master resume in Profile for changes that carry across roles. Cover letters live in the job drawer.
          </div>
        </div>

        {/* Middle — resume preview */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
          className="resume-print-center"
        >
          {loading ? (
            <KimchiProcessLoader
              preset="resumeTailor"
              title={`Tailoring your resume for ${jobTitle}${company ? ` at ${company}` : ""}…`}
              variant="centered"
            />
          ) : activeSections.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 80, color: "var(--scout-muted)", maxWidth: 360 }}>
              <p style={{ fontSize: 14 }}>No tailored resume saved for this role yet.</p>
              <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
                Close this editor and use <strong>Improve resume match</strong> in the job drawer — then choose <strong>Save &amp; open editor</strong> after tailoring.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: "#FFFFFF",
                width: "100%",
                maxWidth: 720,
                padding: compactPreview ? "40px 48px" : "52px 60px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.10)",
                borderRadius: "var(--scout-radius)",
                fontSize: compactPreview ? style.fontSizeBody - 1 : style.fontSizeBody,
                lineHeight: compactPreview ? 1.45 : 1.55,
                color: "#1A1A1A",
                fontFamily: style.fontFamily,
                ...styleCss,
              }}
            >
              {/* Personal info header */}
              {personalInfo ? (
                <div style={{ textAlign: style.headerAlign === "left" ? "left" : "center", marginBottom: 24, paddingBottom: 20, borderBottom: style.hideDivider ? "none" : "1.5px solid #1A1A1A" }}>
                  {personalInfo.content.split("\n").map((line, i) => (
                    <p key={i} style={{ margin: 0, fontSize: i === 0 ? (compactPreview ? style.fontSizeName - 4 : style.fontSizeName) : style.fontSizeBody - 1, fontWeight: i === 0 ? 700 : 400, letterSpacing: i === 0 ? 2 : 0, color: "#1A1A1A", lineHeight: i === 0 ? 1.2 : 1.8 }}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}

              {/* Content sections */}
              {contentSections.map((section) => (
                <div key={section.id} style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: style.fontSizeSection, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: style.accentTarget === "headings" || style.accentTarget === "all" ? style.accentColor : "#1A1A1A", marginBottom: 6, borderBottom: style.hideDivider ? "none" : "1px solid #1A1A1A", paddingBottom: 3 }}>
                    {section.title}
                  </p>
                  {section.type === "bullets" ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {section.content.split("\n").filter(Boolean).map((b, i) => (
                        <li key={i} style={{ marginBottom: 3, fontSize: style.fontSizeBody }}>{bulletPrefix}{b.replace(/^[-•–]\s*/, "")}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: style.fontSizeBody, whiteSpace: "pre-wrap" }}>{section.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Preview banner */}
          {previewSections && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 20px",
                background: "#1C3A2F",
                borderRadius: "var(--scout-radius)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                maxWidth: 720,
                width: "100%",
              }}
            >
              <span style={{ fontSize: 13, color: "#E8D5A3", flex: 1 }}>AI has regenerated your resume. Accept to apply changes.</span>
              <button onClick={acceptRegenerate} style={{ padding: "7px 16px", background: "#E8D5A3", color: "#1C3A2F", border: "none", borderRadius: "var(--scout-radius)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Accept</button>
              <button onClick={() => setPreviewSections(null)} style={{ padding: "7px 16px", background: "transparent", color: "#E8D5A3", border: "1px solid rgba(232,213,163,0.4)", borderRadius: "var(--scout-radius)", fontSize: 14, cursor: "pointer" }}>Discard</button>
            </div>
          )}
        </div>

        {/* Right — section editor + style */}
        <div
          className="resume-print-hide"
          style={{
            width: 280,
            borderLeft: "1px solid #E5DDD0",
            display: "flex",
            flexDirection: "column",
            background: "#FDFAF5",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid #E5DDD0" }}>
            {(["sections", "style"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  background: rightTab === tab ? "#F0EDE8" : "#FDFAF5",
                  border: "none",
                  borderBottom: rightTab === tab ? "2px solid #1C3A2F" : "2px solid transparent",
                  fontSize: 12,
                  fontWeight: 700,
                  color: rightTab === tab ? "#1A1A1A" : "#7A6E64",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {rightTab === "style" ? (
            <ResumeStylePanel style={resumeStyle} onChange={updateResumeStyle} compact />
          ) : (
            <>
          <div style={{ padding: "20px 20px 0", borderBottom: "1px solid #E5DDD0", paddingBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--scout-muted)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Sections</p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {activeSections.map((section) => (
              <div key={section.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    background: editingId === section.id ? "#F0EDE8" : "transparent",
                    borderLeft: editingId === section.id ? "2px solid #1C3A2F" : "2px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A", flex: 1 }}>{section.title}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => {
                        if (editingId === section.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(section.id);
                          setEditDraft(section.content);
                        }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--scout-muted)", display: "flex", alignItems: "center" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => deleteSection(section.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--scout-muted)", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {editingId === section.id && (
                  <div style={{ padding: "8px 20px 14px" }}>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => updateSection(section.id, editDraft)}
                      rows={6}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #D8D0C5",
                        borderRadius: "var(--scout-radius)",
                        fontSize: 14,
                        fontFamily: fontSans,
                        color: "#1A1A1A",
                        resize: "vertical",
                        background: "#FFFFFF",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      placeholder={section.type === "bullets" ? "One bullet per line..." : "Section content..."}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 20px", borderTop: "1px solid #E5DDD0" }}>
            <button
              onClick={addSection}
              style={{
                width: "100%",
                padding: "8px 0",
                background: "transparent",
                border: "1px dashed #D8D0C5",
                borderRadius: "var(--scout-radius)",
                fontSize: 14,
                color: "#6B6258",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div
        className="resume-print-hide"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 56,
          borderTop: "1px solid #E5DDD0",
          background: "#FDFAF5",
          flexShrink: 0,
        }}
      >
        <div ref={downloadRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
            disabled={downloading || loading || activeSections.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "#1C3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: "var(--scout-radius)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              opacity: (downloading || loading || activeSections.length === 0) ? 0.5 : 1,
            }}
          >
            {downloading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
            Download Resume
            <ChevronDown size={13} />
          </button>
          {downloadMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                background: "#FFFFFF",
                border: "1px solid #E5DDD0",
                borderRadius: "var(--scout-radius)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: 180,
                overflow: "hidden",
              }}
            >
              <button
                onClick={downloadPdf}
                style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", fontSize: 13, color: "#1A1A1A", cursor: "pointer", display: "block" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                Download as PDF
              </button>
              <button
                onClick={downloadDocx}
                style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", fontSize: 13, color: "#1A1A1A", cursor: "pointer", borderTop: "1px solid #F0EDE8", display: "block" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                Download as DOCX
              </button>
            </div>
          )}
        </div>

        <button
          onClick={regenerate}
          disabled={regenerating || loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            background: "#1A3A2F",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "var(--scout-radius)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            opacity: (regenerating || loading) ? 0.6 : 1,
          }}
        >
          {regenerating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
          Regenerate
        </button>
      </div>

      <style>{`
        @media print {
          body > *:not(.resume-print-outer) { display: none !important; }
          .resume-print-outer {
            position: static !important;
            display: block !important;
            padding: 0 !important;
          }
          .resume-print-backdrop { display: none !important; }
          .resume-print-target {
            display: flex !important;
            position: static !important;
            height: auto !important;
            max-width: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          .resume-print-hide { display: none !important; }
          .resume-print-center {
            flex: 1 !important;
            overflow: visible !important;
            padding: 0 !important;
          }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {showUpgrade && (
        <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </div>
    </div>
  );
}
