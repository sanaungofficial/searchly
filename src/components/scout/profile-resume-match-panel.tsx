"use client";

import { JR } from "./profile-resume-editor-panels";
import type { JobMatchResult } from "@/lib/resume-match";

export function MatchTag() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 0, background: JR.greenLight, color: JR.greenDark, border: `1px solid ${JR.green}`, marginLeft: 8 }}>
      Match
    </span>
  );
}

export function ResumeMatchPanel(props: {
  jobDescription: string;
  onJobDescriptionChange: (v: string) => void;
  onRunMatch: () => void;
  loading: boolean;
  result: JobMatchResult | null;
  error?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
  embedded?: boolean;
}) {
  const { jobDescription, onJobDescriptionChange, onRunMatch, loading, result, error, collapsed, onToggle, embedded } = props;

  if (collapsed) {
    return (
      <button type="button" onClick={onToggle} style={{ position: "absolute", right: 16, top: 72, zIndex: 5, padding: "8px 14px", background: JR.green, color: JR.gold, border: "none", borderRadius: 0, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        Match analysis
      </button>
    );
  }

  return (
    <div style={{ width: embedded ? "100%" : 300, flexShrink: embedded ? undefined : 0, borderLeft: embedded ? "none" : `1px solid ${JR.border}`, borderTop: embedded ? `1px solid ${JR.border}` : "none", background: JR.panel, display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: embedded ? 320 : undefined }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${JR.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: JR.text }}>Match analysis</p>
          {onToggle && !embedded && <button type="button" onClick={onToggle} style={{ background: "none", border: "none", fontSize: 11, color: JR.muted, cursor: "pointer" }}>Hide</button>}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: JR.muted }}>Paste job description here to see how well you match the role.</p>
      </div>
      <div style={{ padding: 16, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea rows={embedded ? 4 : 8} value={jobDescription} onChange={(e) => onJobDescriptionChange(e.target.value)} placeholder="Paste the full job description…" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${JR.border}`, borderRadius: 0, fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        <button type="button" onClick={onRunMatch} disabled={loading || !jobDescription.trim()} style={{ width: "100%", padding: "10px 14px", background: loading || !jobDescription.trim() ? JR.bg : JR.green, color: loading || !jobDescription.trim() ? JR.muted : "#FFF", border: "none", borderRadius: 0, fontSize: 13, fontWeight: 700, cursor: loading || !jobDescription.trim() ? "not-allowed" : "pointer" }}>
          {loading ? "Analyzing match…" : "Run match analysis"}
        </button>
        {error && <p style={{ margin: 0, fontSize: 12, color: JR.urgent }}>{error}</p>}
        {result && (
          <>
            {result._fallback && <p style={{ margin: 0, fontSize: 11, color: JR.muted, padding: "8px 10px", background: JR.bg, borderRadius: 0 }}>Keyword-based match on dev — full AI on production.</p>}
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: result.score >= 7 ? JR.greenDark : JR.urgent }}>{result.score.toFixed(1)}<span style={{ fontSize: 16, color: JR.muted }}>/10</span></p>
              <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700 }}>{result.scoreLabel}</p>
            </div>
            {result.summaryNote && <p style={{ margin: 0, fontSize: 12, color: JR.muted }}>{result.summaryNote}</p>}
            {result.keywords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.keywords.map((kw) => (
                  <span key={kw.text} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 0, background: kw.matched ? JR.greenLight : JR.urgentBg, color: kw.matched ? JR.greenDark : JR.urgent }}>
                    {kw.matched ? "✓" : "○"} {kw.text}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
