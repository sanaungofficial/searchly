"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import {
  defaultSelectedMergeSections,
  type LinkedInAboutMergeDiff,
  type LinkedInAboutMergeSection,
} from "@/lib/linkedin-about-merge";
import { border, color, fontSans, surface } from "@/lib/typography";

const muted: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 13,
  color: color.muted,
  margin: 0,
  lineHeight: 1.5,
};

type Props = {
  open: boolean;
  loading: boolean;
  applying: boolean;
  error: string | null;
  diffs: LinkedInAboutMergeDiff[];
  isFirstBuild: boolean;
  onClose: () => void;
  onApply: (sections: LinkedInAboutMergeSection[]) => void;
};

export function LinkedInAboutMergeModal({
  open,
  loading,
  applying,
  error,
  diffs,
  isFirstBuild,
  onClose,
  onApply,
}: Props) {
  const [selected, setSelected] = useState<Set<LinkedInAboutMergeSection>>(new Set());

  const changeCount = useMemo(() => diffs.filter((d) => d.hasChange).length, [diffs]);

  useEffect(() => {
    if (!open || loading) return;
    setSelected(new Set(defaultSelectedMergeSections(diffs)));
  }, [open, loading, diffs]);

  const toggle = (section: LinkedInAboutMergeSection) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(diffs.map((d) => d.section)));
  const selectChanged = () => setSelected(new Set(diffs.filter((d) => d.hasChange).map((d) => d.section)));

  return (
    <ScoutModal
      open={open}
      onClose={applying ? () => {} : onClose}
      maxWidth={760}
      bruddle
      ariaLabelledBy="linkedin-about-merge-title"
      panelStyle={{ maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <ScoutDisplayTitle id="linkedin-about-merge-title" size={22} style={{ margin: "0 0 8px" }}>
        {isFirstBuild ? "Build from About" : "Review About updates"}
      </ScoutDisplayTitle>
      <p style={{ ...muted, marginBottom: 16 }}>
        {isFirstBuild
          ? "Choose which sections from your About profile to bring into this LinkedIn preview. Nothing is applied until you confirm."
          : changeCount > 0
            ? `About has ${changeCount} section${changeCount === 1 ? "" : "s"} that differ from your LinkedIn preview. Check what you want to bring over — unchecked sections stay as-is.`
            : "About matches your current preview. You can still re-apply any section if you want to reset it from About."}
      </p>

      {loading ? (
        <p style={muted}>Loading About data…</p>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button type="button" onClick={selectChanged} style={linkBtnStyle}>
              Select changed
            </button>
            <button type="button" onClick={selectAll} style={linkBtnStyle}>
              Select all
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diffs.map((row) => {
              const checked = selected.has(row.section);
              return (
                <label
                  key={row.section}
                  style={{
                    display: "block",
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                    padding: 12,
                    background: checked ? "rgba(26,58,47,0.04)" : surface.inset,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(row.section)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 700, color: color.ink }}>
                          {row.label}
                        </span>
                        {row.hasChange ? (
                          <span
                            style={{
                              fontFamily: fontSans,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.4,
                              color: color.forest,
                              background: "rgba(26,58,47,0.08)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            Changed
                          </span>
                        ) : (
                          <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted }}>No change</span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                        }}
                      >
                        <PreviewColumn title="Current preview" text={row.currentPreview} />
                        <PreviewColumn title="From About" text={row.proposedPreview} highlight={row.hasChange} />
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: "#C05050", margin: "0 0 12px" }}>{error}</p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <ScoutSecondaryBtn type="button" onClick={onClose} disabled={applying}>
          Cancel
        </ScoutSecondaryBtn>
        <ScoutPrimaryBtn
          type="button"
          onClick={() => onApply([...selected])}
          disabled={loading || applying || selected.size === 0}
        >
          {applying ? "Applying…" : `Apply selected (${selected.size})`}
        </ScoutPrimaryBtn>
      </div>
    </ScoutModal>
  );
}

function PreviewColumn({ title, text, highlight = false }: { title: string; text: string; highlight?: boolean }) {
  return (
    <div
      style={{
        border: highlight ? "1px solid rgba(26,58,47,0.25)" : border.line,
        borderRadius: 6,
        padding: "8px 10px",
        background: "#fff",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: color.muted,
          margin: "0 0 4px",
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: 12,
          color: color.ink,
          margin: 0,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text}
      </p>
    </div>
  );
}

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: fontSans,
  fontSize: 12,
  fontWeight: 600,
  color: color.forest,
  cursor: "pointer",
  textDecoration: "underline",
};
