"use client";

import { JR } from "./profile-resume-editor-panels";
import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  type ResumeStyleSettings,
} from "@/lib/resume-style";

const FONT_OPTIONS = [
  { value: "Carlito, Calibri, sans-serif", label: "Carlito (Calibri-like)" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Times New Roman, serif", label: "Times New Roman" },
];

export function ResumeStylePanel({
  style,
  onChange,
  compact,
}: {
  style: ResumeStyleSettings;
  onChange: (next: ResumeStyleSettings) => void;
  compact?: boolean;
}) {
  const s = normalizeResumeStyle(style);

  function patch(partial: Partial<ResumeStyleSettings>) {
    onChange({ ...s, ...partial });
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: JR.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    margin: "0 0 8px",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: `1px solid ${JR.border}`,
    borderRadius: "var(--scout-radius)",
    fontSize: 13,
    background: JR.panel,
    color: JR.text,
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: compact ? "12px 14px" : "16px 18px", overflowY: "auto", height: "100%" }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: JR.muted, lineHeight: 1.5 }}>
        Layout and typography apply to preview and downloads.
      </p>

      <p style={labelStyle}>Resume template</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {(["standard", "compact", "centered"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => patch({ template: t })}
            style={{
              padding: "10px 8px",
              border: s.template === t ? `2px solid ${JR.green}` : `1px solid ${JR.border}`,
              borderRadius: "var(--scout-radius)",
              background: s.template === t ? JR.greenLight : JR.panel,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <p style={labelStyle}>Accent color</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="color"
          value={s.accentColor}
          onChange={(e) => patch({ accentColor: e.target.value })}
          style={{ width: 44, height: 36, border: `1px solid ${JR.border}`, borderRadius: "var(--scout-radius)", padding: 2 }}
        />
        <select
          value={s.accentTarget}
          onChange={(e) => patch({ accentTarget: e.target.value as ResumeStyleSettings["accentTarget"] })}
          style={{ ...selectStyle, flex: 1 }}
        >
          <option value="headings">Headings only</option>
          <option value="all">All headings</option>
        </select>
      </div>

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: JR.text }}>Fit to one page</span>
        <input type="checkbox" checked={s.fitToOnePage} onChange={(e) => patch({ fitToOnePage: e.target.checked })} />
      </label>

      <p style={labelStyle}>Font family</p>
      <select value={s.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })} style={{ ...selectStyle, marginBottom: 16 }}>
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <p style={labelStyle}>Font sizes</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { key: "fontSizeName" as const, label: "Name" },
          { key: "fontSizeSection" as const, label: "Sections" },
          { key: "fontSizeSub" as const, label: "Sub-headers" },
          { key: "fontSizeBody" as const, label: "Body" },
        ].map(({ key, label }) => (
          <div key={key}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: JR.muted }}>{label}</p>
            <input
              type="number"
              min={8}
              max={32}
              value={s[key]}
              onChange={(e) => patch({ [key]: Number(e.target.value) || DEFAULT_RESUME_STYLE[key] })}
              style={selectStyle}
            />
          </div>
        ))}
      </div>

      <p style={labelStyle}>Bullet style</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["dot", "dash"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => patch({ bulletStyle: b })}
            style={{
              flex: 1,
              padding: "8px",
              border: s.bulletStyle === b ? `2px solid ${JR.green}` : `1px solid ${JR.border}`,
              borderRadius: "var(--scout-radius)",
              background: JR.panel,
              cursor: "pointer",
            }}
          >
            {b === "dot" ? "•" : "–"}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: JR.text }}>Hide section dividers</span>
        <input type="checkbox" checked={s.hideDivider} onChange={(e) => patch({ hideDivider: e.target.checked })} />
      </label>
    </div>
  );
}
