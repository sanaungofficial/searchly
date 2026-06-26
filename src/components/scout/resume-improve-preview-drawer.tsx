"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { JR } from "./profile-resume-editor-panels";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import type { ParsedResumeData } from "@/lib/resume-parse";
import { JobrightResumeDocument } from "./profile-resume-jobright-document";

export interface ImproveHighlight {
  sectionId?: string;
  label?: string;
  before?: string;
  after?: string;
  reason?: string;
}

export function ResumeImprovePreviewDrawer({
  open,
  loading,
  error,
  previousScore,
  newScore,
  changes,
  highlights,
  previewData,
  onClose,
  onAccept,
  accepting,
}: {
  open: boolean;
  loading: boolean;
  error?: string | null;
  previousScore?: number;
  newScore?: number;
  changes: string[];
  highlights: ImproveHighlight[];
  previewData: ParsedResumeData | null;
  onClose: () => void;
  onAccept: () => void;
  accepting?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    setVisible(open);
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(17,24,39,0.35)",
          zIndex: 1600,
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
          width: "min(960px, 94vw)",
          background: JR.panel,
          zIndex: 1601,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.16)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s ease",
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${JR.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: JR.muted, display: "flex" }}>
            <ChevronRight size={18} />
          </button>
          <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: JR.text }}>Review improved resume</p>
          {newScore != null && (
            <span style={{ fontSize: 13, fontWeight: 700, color: JR.greenDark }}>
              {previousScore != null ? `${previousScore} → ` : ""}{newScore}/100
            </span>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: "0 0 42%", overflowY: "auto", padding: "20px 22px", borderRight: `1px solid ${JR.border}`, background: JR.bg }}>
            {loading ? (
              <KimchiProcessLoader preset="resumeTailor" variant="centered" />
            ) : error ? (
              <p style={{ fontSize: 14, color: JR.urgent }}>{error}</p>
            ) : (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: JR.text }}>What changed</p>
                <ul style={{ margin: "0 0 20px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: JR.text }}>
                  {changes.map((c) => (
                    <li key={c} style={{ marginBottom: 8 }}>{c}</li>
                  ))}
                </ul>
                {highlights.slice(0, 8).map((h, i) => (
                  <div key={i} style={{ marginBottom: 14, padding: "12px 14px", background: JR.panel, border: `1px solid ${JR.border}` }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: JR.greenDark }}>{h.label ?? h.sectionId}</p>
                    {h.reason && <p style={{ margin: "0 0 8px", fontSize: 12, color: JR.muted }}>{h.reason}</p>}
                    {h.before && (
                      <p style={{ margin: "0 0 4px", fontSize: 11, color: JR.urgent, textDecoration: "line-through", whiteSpace: "pre-wrap" }}>{h.before}</p>
                    )}
                    {h.after && (
                      <p style={{ margin: 0, fontSize: 11, color: JR.greenDark, background: JR.greenLight, padding: "6px 8px", whiteSpace: "pre-wrap" }}>{h.after}</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: JR.bg }}>
            {previewData && !loading && (
              <JobrightResumeDocument
                data={previewData}
                onChange={() => {}}
                onFixSection={() => {}}
                score={newScore ?? previousScore ?? 0}
                grade="B"
                gradeLabel="PREVIEW"
                onViewReport={() => {}}
              />
            )}
          </div>
        </div>

        {!loading && previewData && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${JR.border}`, display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "12px 18px", background: JR.panel, border: `1px solid ${JR.border}`, borderRadius: "var(--scout-radius)", fontSize: 14, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={accepting}
              style={{
                flex: 1,
                padding: "12px 18px",
                background: accepting ? "rgba(26,58,47,0.35)" : JR.green,
                color: JR.gold,
                border: "none",
                borderRadius: "var(--scout-radius)",
                fontSize: 14,
                fontWeight: 700,
                cursor: accepting ? "wait" : "pointer",
              }}
            >
              {accepting ? "Applying…" : "Insert improved resume"}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
