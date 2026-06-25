"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, HelpCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { JR } from "./profile-resume-editor-panels";
import type { ResumeSectionId } from "@/lib/resume-parse";
import type { FullAnalysisReport } from "./profile-resume-analysis-report";

export interface SectionFixIssue {
  id: string;
  severity: "Urgent" | "Critical" | "Optional" | "Minor";
  title: string;
  issueDetected: string;
  whyItMatters: string;
  howToImprove: string;
}

const SECTION_TITLES: Record<ResumeSectionId, string> = {
  summary: "Professional Summary",
  skills: "Areas of Emphasis",
  experience: "Work Experience",
  education: "Education & Training",
  certifications: "Certifications",
};

const SECTION_PATTERNS: Record<ResumeSectionId, RegExp> = {
  summary: /summary|overview|headline|professional summary/i,
  skills: /skill|emphasis|keyword|relevant|competenc/i,
  experience: /experience|accomplish|bullet|impact|methodology|work|achievement|quant/i,
  education: /education|degree|training|school|mba/i,
  certifications: /certif|credential|license/i,
};

export function getSectionFixIssues(
  sectionId: ResumeSectionId,
  fullReport: FullAnalysisReport,
  mode: "all" | "impact" = "all",
): SectionFixIssue[] {
  const pattern = SECTION_PATTERNS[sectionId];
  const fromHighlights = fullReport.highlights.flatMap((group) =>
    group.items
      .filter((item) => item.sectionHint === sectionId || pattern.test(`${item.title} ${item.summary}`))
      .map((item, i) => ({
        id: `${sectionId}-h-${i}`,
        severity: item.severity,
        title: item.title,
        issueDetected: item.summary,
        whyItMatters: item.whyItMatters,
        howToImprove: item.whyItMatters,
      })),
  );

  const fromIssues = fullReport.issues
    .filter((issue) => pattern.test(`${issue.title} ${issue.detail}`))
    .map((issue, i) => ({
      id: `${sectionId}-i-${i}`,
      severity: issue.priority,
      title: issue.title,
      issueDetected: issue.detail,
      whyItMatters: issue.detail,
      howToImprove: issue.detail,
    }));

  const combined = fromHighlights.length ? fromHighlights : fromIssues;
  if (mode === "impact") {
    return combined.filter((issue) => issue.severity === "Urgent" || issue.severity === "Critical");
  }
  return combined;
}

function severityLabel(severity: SectionFixIssue["severity"]) {
  if (severity === "Urgent" || severity === "Critical") return { text: "Urgent", color: JR.urgent, bg: JR.urgentBg };
  if (severity === "Minor") return { text: "Minor", color: "#CA8A04", bg: "#FEF9C3" };
  return { text: "Optional", color: JR.muted, bg: JR.optionalBg };
}

export function ResumeSectionFixDrawer({
  open,
  sectionId,
  entryLabel,
  issues,
  onClose,
  sectionTitle,
  drawerMode = "fix",
  suggestions = [],
  suggestionsLoading = false,
  onApplySuggestion,
  emptyMessage,
}: {
  open: boolean;
  sectionId: ResumeSectionId | string | null;
  entryLabel?: string;
  issues: SectionFixIssue[];
  onClose: () => void;
  sectionTitle?: string;
  drawerMode?: "impact" | "fix";
  suggestions?: { id: string; label: string; text: string }[];
  suggestionsLoading?: boolean;
  onApplySuggestion?: (text: string) => void;
  emptyMessage?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [activeIssueId, setActiveIssueId] = useState<string>("overall");
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    setVisible(open);
    if (open) setActiveIssueId("overall");
  }, [open, sectionId]);

  if (!open || !sectionId || !mounted) return null;

  const title = entryLabel
    ? `${sectionTitle ?? (sectionId && sectionId in SECTION_TITLES ? SECTION_TITLES[sectionId as ResumeSectionId] : sectionId)} · ${entryLabel}`
    : sectionTitle ?? (sectionId && sectionId in SECTION_TITLES ? SECTION_TITLES[sectionId as ResumeSectionId] : String(sectionId ?? "Section"));
  const urgentCount = issues.filter((i) => i.severity === "Urgent" || i.severity === "Critical").length;
  const activeIssue = activeIssueId === "overall" ? issues[0] : issues.find((i) => i.id === activeIssueId) || issues[0];

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(17,24,39,0.2)",
          zIndex: 1500,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(720px, 88vw)",
          background: JR.panel,
          zIndex: 1501,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.14)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s ease",
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${JR.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: JR.muted, display: "flex" }}>
            <ChevronRight size={18} />
          </button>
          <p style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, color: JR.text }}>{title}</p>
          {urgentCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 0, background: JR.urgentBg, color: JR.urgent, fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: JR.urgent }} />
              {urgentCount} Urgent
            </span>
          )}
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ width: 160, borderRight: `1px solid ${JR.border}`, padding: "12px 8px", overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => setActiveIssueId("overall")}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 0,
                border: "none",
                cursor: "pointer",
                background: activeIssueId === "overall" ? JR.bg : "transparent",
                fontSize: 13,
                fontWeight: 600,
                color: JR.text,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {urgentCount > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: JR.urgent, flexShrink: 0 }} />}
              Overall
            </button>
            {issues.slice(1).map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => setActiveIssueId(issue.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 0,
                  border: "none",
                  cursor: "pointer",
                  background: activeIssueId === issue.id ? JR.bg : "transparent",
                  fontSize: 12,
                  fontWeight: 500,
                  color: JR.muted,
                  marginTop: 4,
                }}
              >
                {issue.title}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: JR.text }}>
              {drawerMode === "impact" ? "Why this matters" : "Suggested fixes"}
            </p>

            {suggestionsLoading && (
              <p style={{ fontSize: 14, color: JR.muted, marginBottom: 16 }}>Generating options…</p>
            )}

            {drawerMode === "fix" && suggestions.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: JR.text }}>Apply a suggestion</p>
                {suggestions.map((s) => (
                  <div key={s.id} style={{ marginBottom: 12, padding: "14px 16px", border: `1px solid ${JR.border}`, background: JR.bg }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: JR.muted }}>{s.label}</p>
                    <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: JR.text, whiteSpace: "pre-wrap" }}>{s.text}</p>
                    {onApplySuggestion && (
                      <button
                        type="button"
                        onClick={() => onApplySuggestion(s.text)}
                        style={{
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          border: "none",
                          borderRadius: 0,
                          background: JR.greenDark,
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        Apply this option
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {issues.length === 0 && !suggestionsLoading && suggestions.length === 0 ? (
              <p style={{ fontSize: 14, color: JR.muted, lineHeight: 1.55 }}>
                {emptyMessage ?? "No specific issues for this section yet. Run analysis for tailored feedback."}
              </p>
            ) : (
              issues.map((issue) => {
                const sev = severityLabel(issue.severity);
                const show = !activeIssue || activeIssue.id === issue.id || activeIssueId === "overall";
                if (!show) return null;
                return (
                  <div key={issue.id} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sev.color }} />
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: JR.text }}>{issue.title}</p>
                    </div>
                    <div style={{ background: "#FFF5F5", borderRadius: 0, padding: "18px 20px", border: `1px solid #FECACA` }}>
                      <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: JR.text }}>Issue Detected</p>
                      <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.55, color: JR.text }}>{issue.issueDetected}</p>
                      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: JR.text }}>Why This Is Important</p>
                      <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.55, color: JR.muted }}>{issue.whyItMatters}</p>
                      {drawerMode === "fix" && (
                        <>
                          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: JR.text }}>How To Improve</p>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: JR.text }}>{issue.howToImprove}</p>
                        </>
                      )}
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${JR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 12, color: JR.muted, display: "flex", alignItems: "center", gap: 4 }}>
                          Was This Suggestion Helpful? <HelpCircle size={12} />
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" style={{ background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 0, padding: "6px 10px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <ThumbsUp size={12} /> Looks Great!
                          </button>
                          <button type="button" style={{ background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: 0, padding: "6px 10px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <ThumbsDown size={12} /> Not What I Expected
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
