"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface } from "@/lib/typography";

export type SelectiveMergeDiff = {
  section: string;
  label: string;
  hasChange: boolean;
  currentPreview: string;
  proposedPreview: string;
  kind?: "text" | "photo";
  currentPhotoUrl?: string | null;
  proposedPhotoUrl?: string | null;
};

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
  title: string;
  description: string;
  emptyDescription?: string;
  loadingLabel: string;
  currentColumnTitle: string;
  proposedColumnTitle: string;
  diffs: SelectiveMergeDiff[];
  defaultSelected: (diffs: SelectiveMergeDiff[]) => string[];
  onClose: () => void;
  onApply: (sections: string[]) => void;
};

export function SelectiveMergeModal({
  open,
  loading,
  applying,
  error,
  title,
  description,
  emptyDescription,
  loadingLabel,
  currentColumnTitle,
  proposedColumnTitle,
  diffs,
  defaultSelected,
  onClose,
  onApply,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const changeCount = useMemo(() => diffs.filter((d) => d.hasChange).length, [diffs]);
  const bodyDescription =
    changeCount > 0 ? description : emptyDescription ?? description;

  useEffect(() => {
    if (!open || loading) return;
    setSelected(new Set(defaultSelected(diffs)));
  }, [open, loading, diffs, defaultSelected]);

  const toggle = (section: string) => {
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
      ariaLabelledBy="selective-merge-title"
      panelStyle={{ maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <ScoutDisplayTitle id="selective-merge-title" size={22} style={{ margin: "0 0 8px" }}>
        {title}
      </ScoutDisplayTitle>
      <p style={{ ...muted, marginBottom: 16 }}>{bodyDescription}</p>

      {loading ? (
        <p style={muted}>{loadingLabel}</p>
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
                        {row.kind === "photo" ? (
                          <>
                            <PhotoPreviewColumn title={currentColumnTitle} url={row.currentPhotoUrl} />
                            <PhotoPreviewColumn
                              title={proposedColumnTitle}
                              url={row.proposedPhotoUrl}
                              highlight={row.hasChange}
                            />
                          </>
                        ) : (
                          <>
                            <PreviewColumn title={currentColumnTitle} text={row.currentPreview} />
                            <PreviewColumn
                              title={proposedColumnTitle}
                              text={row.proposedPreview}
                              highlight={row.hasChange}
                            />
                          </>
                        )}
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

function PhotoPreviewColumn({
  title,
  url,
  highlight = false,
}: {
  title: string;
  url?: string | null;
  highlight?: boolean;
}) {
  const hasPhoto = !!url?.trim();
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
          margin: "0 0 6px",
        }}
      >
        {title}
      </p>
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          style={{
            width: "100%",
            maxHeight: 72,
            objectFit: "cover",
            borderRadius: 4,
            border: `1px solid ${border.line}`,
          }}
        />
      ) : (
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>(no photo)</p>
      )}
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
