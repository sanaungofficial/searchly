"use client";

import { useLayoutEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { JR } from "./profile-resume-editor-panels";
import type { ReportIssue } from "./profile-resume-editor-panels";
import type { ResumeSectionId } from "@/lib/resume-parse";

export interface ReportHighlightItem {
  severity: "Minor" | "Urgent" | "Critical" | "Optional";
  title: string;
  issueCount: number;
  summary: string;
  whyItMatters: string;
  sectionHint?: ResumeSectionId;
}

export interface ReportHighlightCategory {
  category: string;
  items: ReportHighlightItem[];
}

export interface FullAnalysisReport {
  score: number;
  grade: string;
  gradeLabel: string;
  headline: string;
  strengths?: string[];
  issues: ReportIssue[];
  highlights: ReportHighlightCategory[];
  updatedAt?: string | null;
}

export function scoreToGrade(score: number): { grade: string; label: string } {
  if (score >= 90) return { grade: "A", label: "EXCELLENT" };
  if (score >= 80) return { grade: "B", label: "GOOD" };
  if (score >= 70) return { grade: "C", label: "FAIR" };
  if (score >= 60) return { grade: "D", label: "NEEDS WORK" };
  return { grade: "F", label: "POOR" };
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "Recently";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function HexGradeBadge({ grade, size = 56 }: { grade: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <polygon
          points="28,2 52,15 52,41 28,54 4,41 4,15"
          fill="#F5E6B8"
          stroke="#D4AF37"
          strokeWidth="1.5"
        />
        <text x="28" y="34" textAnchor="middle" fontSize="22" fontWeight="700" fill="#8B6914">
          {grade}
        </text>
      </svg>
    </div>
  );
}

function severityDot(severity: ReportHighlightItem["severity"]) {
  if (severity === "Urgent" || severity === "Critical") return JR.urgent;
  if (severity === "Minor") return "#EAB308";
  return JR.muted;
}

export function buildFullReport(input: {
  score?: number;
  headline?: string;
  strengths?: string[];
  issues: ReportIssue[];
  highlights?: ReportHighlightCategory[];
  updatedAt?: string | null;
}): FullAnalysisReport {
  const score = input.score ?? 0;
  const { grade, label } = scoreToGrade(score);
  const highlights =
    input.highlights?.length
      ? input.highlights
      : groupIssuesIntoHighlights(input.issues);

  return {
    score,
    grade,
    gradeLabel: label,
    headline: input.headline || "Review the highlights below to improve your resume.",
    strengths: input.strengths,
    issues: input.issues,
    highlights,
    updatedAt: input.updatedAt,
  };
}

function groupIssuesIntoHighlights(issues: ReportIssue[]): ReportHighlightCategory[] {
  const buckets: Record<string, ReportHighlightItem[]> = {
    Relevance: [],
    "Impact & Achievements": [],
    "Brevity & Effectiveness": [],
  };

  for (const issue of issues) {
    const lower = `${issue.title} ${issue.detail}`.toLowerCase();
    let category = "Brevity & Effectiveness";
    if (/summary|skill|keyword|relevant|role|title/.test(lower)) category = "Relevance";
    else if (/metric|achievement|impact|bullet|quant|result/.test(lower)) category = "Impact & Achievements";

    const severity: ReportHighlightItem["severity"] =
      issue.priority === "Urgent" ? "Urgent" : issue.priority === "Critical" ? "Critical" : "Minor";

    buckets[category].push({
      severity,
      title: issue.title,
      issueCount: 1,
      summary: issue.detail,
      whyItMatters: issue.detail,
    });
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }));
}

export function ResumeAnalysisReportDrawer({
  open,
  onClose,
  report,
  loading,
  error,
  onBeginImprovements,
  onRefresh,
  aiUnavailable,
}: {
  open: boolean;
  onClose: () => void;
  report: FullAnalysisReport | null;
  loading: boolean;
  error?: string;
  onBeginImprovements: () => void;
  onRefresh: () => void;
  aiUnavailable?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    setVisible(open);
  }, [open]);

  if (!open) return null;

  const urgentCount = report?.issues.filter((i) => i.priority === "Urgent").length ?? 0;
  const criticalCount = report?.issues.filter((i) => i.priority === "Critical").length ?? 0;
  const optionalCount = report?.issues.filter((i) => i.priority === "Optional").length ?? 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(17,24,39,0.25)",
          zIndex: 30,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 92vw)",
          background: JR.panel,
          zIndex: 31,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${JR.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: JR.text, display: "flex", padding: 4 }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: JR.text }}>Resume Analysis Report</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: JR.muted }}>
              Last updated {formatRelativeTime(report?.updatedAt)}
            </p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: JR.muted, padding: "40px 0", justifyContent: "center" }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              <span>Generating report…</span>
            </div>
          ) : error ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: JR.muted, marginBottom: 12 }}>{error}</p>
              <button type="button" onClick={onRefresh} style={{ padding: "8px 16px", background: JR.green, color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Retry analysis
              </button>
            </div>
          ) : report ? (
            <>
              {/* Score row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <HexGradeBadge grade={report.grade} />
                <div>
                  <span style={{ display: "inline-block", padding: "3px 10px", background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                    {report.gradeLabel}
                  </span>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: JR.muted }}>Overall score {report.score}%</p>
                </div>
              </div>

              {/* Issue counters */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
                {[
                  { count: urgentCount, label: "URGENT FIX", bg: "#FEE2E2", color: JR.urgent },
                  { count: criticalCount, label: "CRITICAL FIX", bg: "#FFEDD5", color: "#EA580C" },
                  { count: optionalCount, label: "OPTIONAL FIX", bg: "#E0F2FE", color: "#0284C7" },
                ].map((box) => (
                  <div key={box.label} style={{ background: box.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: box.color }}>{box.count}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: box.color }}>{box.label}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {aiUnavailable && report.issues.length > 0 && (
                <p style={{ fontSize: 12, color: JR.muted, margin: "0 0 12px", padding: "10px 12px", background: JR.bg, borderRadius: 8 }}>
                  AI analysis unavailable — showing completeness-based feedback. Re-analyze on production for full AI insights.
                </p>
              )}
              <p style={{ fontSize: 14, lineHeight: 1.65, color: JR.text, margin: "0 0 24px" }}>{report.headline}</p>

              {/* Highlights */}
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: JR.text }}>Analysis Highlights</p>

              {report.highlights.map((group, idx) => (
                <div key={group.category} style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: JR.muted }}>
                    {idx + 1} {group.category}
                  </p>
                  {group.items.map((item, i) => (
                    <div
                      key={`${item.title}-${i}`}
                      style={{
                        border: `1px solid ${JR.border}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        marginBottom: 10,
                        background: JR.panel,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: severityDot(item.severity), marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: JR.text }}>
                            {item.title}
                            {item.issueCount > 1 ? ` — ${item.issueCount} issues related` : " — 1 issue related"}
                          </p>
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: JR.muted, lineHeight: 1.5 }}>{item.summary}</p>
                        </div>
                      </div>
                      <div style={{ paddingLeft: 16 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: JR.text }}>Why This Is Important</p>
                        <p style={{ margin: "0 0 10px", fontSize: 12, color: JR.muted, lineHeight: 1.5 }}>{item.whyItMatters}</p>
                        <button
                          type="button"
                          style={{
                            padding: "6px 12px",
                            background: JR.panel,
                            border: `1px solid ${JR.border}`,
                            borderRadius: 6,
                            fontSize: 12,
                            color: JR.text,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Learn why this matters <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {!loading && !error && report && (
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${JR.border}`, background: JR.panel }}>
            <button
              type="button"
              onClick={onBeginImprovements}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: JR.green,
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Begin Improvements Now
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export function GradeBadgeRow({
  score,
  onViewReport,
}: {
  score?: number;
  onViewReport: () => void;
}) {
  const pct = score ?? 0;
  const { grade, label } = scoreToGrade(pct);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <HexGradeBadge grade={grade} size={48} />
      <div>
        <span style={{ display: "inline-block", padding: "3px 10px", background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onViewReport}
          style={{
            display: "block",
            marginTop: 6,
            background: "none",
            border: "none",
            padding: 0,
            color: JR.greenDark,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          View Full Report
        </button>
      </div>
    </div>
  );
}
