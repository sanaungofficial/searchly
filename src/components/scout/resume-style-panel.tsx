"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { JR } from "./profile-resume-editor-panels";
import { RT } from "@/lib/resume-tailor-tokens";
import { DEFAULT_RESUME_STYLE, normalizeResumeStyle, type ResumeStyleSettings } from "@/lib/resume-style";

const FONT_OPTIONS = [
  { value: "Carlito, Calibri, sans-serif", label: "Carlito (Calibri-like)" },
  { value: "Georgia, 'Times New Roman', Times, serif", label: "Georgia" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Times New Roman, serif", label: "Times New Roman" },
];

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "monospace" }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "currentColor" }} />
    </div>
  );
}

export function ResumeStylePanel({
  style,
  onChange,
  compact,
  useTailorTokens,
  onFitToOnePage,
}: {
  style: ResumeStyleSettings;
  onChange: (next: ResumeStyleSettings) => void;
  compact?: boolean;
  useTailorTokens?: boolean;
  onFitToOnePage?: () => void;
}) {
  const s = normalizeResumeStyle(style);
  const T = useTailorTokens
    ? { green: RT.green, greenLight: RT.industryMatched, border: RT.border, panel: RT.panelBg, text: RT.text, muted: RT.muted }
    : { green: JR.green, greenLight: JR.greenLight, border: JR.border, panel: JR.panel, text: JR.text, muted: JR.muted };
  const patch = (partial: Partial<ResumeStyleSettings>) => onChange(normalizeResumeStyle({ ...s, ...partial }));
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px" };
  const selectStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: `1px solid ${T.border}`, borderRadius: useTailorTokens ? RT.ctaSecondaryRadius : "var(--scout-radius)", fontSize: 13, background: T.panel, color: T.text, boxSizing: "border-box" };
  const radius = useTailorTokens ? RT.ctaSecondaryRadius : "var(--scout-radius)";

  return (
    <div style={{ padding: compact ? "12px 14px" : "16px 18px", overflowY: "auto", height: "100%", color: T.text }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted, lineHeight: 1.5 }}>Layout and typography apply to preview and downloads.</p>
      <p style={labelStyle}>Resume template</p>
      <select value={s.pageSize} onChange={(e) => patch({ pageSize: e.target.value as ResumeStyleSettings["pageSize"] })} style={{ ...selectStyle, marginBottom: 10 }}>
        <option value="letter">Letter (8.5&quot; × 11&quot;)</option>
        <option value="a4">A4</option>
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {(["standard", "compact", "centered"] as const).map((t) => (
          <button key={t} type="button" onClick={() => patch({ template: t })} style={{ padding: "10px 6px 8px", border: s.template === t ? `2px solid ${T.green}` : `1px solid ${T.border}`, borderRadius: radius, background: s.template === t ? T.greenLight : T.panel, fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
            <div style={{ height: 36, marginBottom: 6, background: "rgba(0,0,0,0.04)", borderRadius: 4, border: `1px solid ${T.border}` }} />
            {t}
            {t === "standard" && <span style={{ display: "block", fontSize: 9, color: T.green, marginTop: 4, fontWeight: 700 }}>★ Recommended</span>}
          </button>
        ))}
      </div>
      <p style={labelStyle}>Accent color</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="color" value={s.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} style={{ width: 44, height: 36, border: `1px solid ${T.border}`, borderRadius: radius, padding: 2 }} />
        <select value={s.accentTarget} onChange={(e) => patch({ accentTarget: e.target.value as ResumeStyleSettings["accentTarget"] })} style={{ ...selectStyle, flex: 1 }}>
          <option value="headings">Headings only</option>
          <option value="all">All headings</option>
        </select>
      </div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Auto fit after custom resume</span>
        <input type="checkbox" checked={s.autoFitAfterCustom} onChange={(e) => patch({ autoFitAfterCustom: e.target.checked })} />
      </label>
      {onFitToOnePage && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <button type="button" onClick={onFitToOnePage} style={{ flex: 1, padding: "10px 14px", background: T.green, color: T.text, border: "none", borderRadius: radius, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Sparkles size={14} /> Fit resume to one page
          </button>
          <button type="button" onClick={() => onChange({ ...DEFAULT_RESUME_STYLE })} title="Reset formatting" style={{ width: 38, height: 38, border: `1px solid ${T.border}`, borderRadius: radius, background: T.panel, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, flexShrink: 0 }}>
            <RotateCcw size={16} />
          </button>
        </div>
      )}
      <p style={labelStyle}>Font</p>
      <select value={s.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })} style={{ ...selectStyle, marginBottom: 12 }}>
        {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {([["fontSizeName", "Name"], ["fontSizeSection", "Section headers"], ["fontSizeSub", "Sub-headers"], ["fontSizeBody", "Body text"]] as const).map(([key, label]) => (
          <div key={key}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.muted }}>{label}</p>
            <input type="number" min={8} max={32} value={s[key]} onChange={(e) => patch({ [key]: Number(e.target.value) || DEFAULT_RESUME_STYLE[key] })} style={selectStyle} />
          </div>
        ))}
      </div>
      <p style={labelStyle}>Content style</p>
      <select value={s.dateFormat} onChange={(e) => patch({ dateFormat: e.target.value as ResumeStyleSettings["dateFormat"] })} style={{ ...selectStyle, marginBottom: 12 }}>
        <option value="short">Short month name (Jan YYYY)</option>
        <option value="long">Full month name (January YYYY)</option>
      </select>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["dot", "dash"] as const).map((b) => (
          <button key={b} type="button" onClick={() => patch({ bulletStyle: b })} style={{ flex: 1, padding: "10px", border: s.bulletStyle === b ? `2px solid ${T.green}` : `1px solid ${T.border}`, borderRadius: radius, background: T.panel, cursor: "pointer", fontSize: 18 }}>{b === "dot" ? "•" : "–"}</button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Hide divider</span>
        <input type="checkbox" checked={s.hideDivider} onChange={(e) => patch({ hideDivider: e.target.checked })} />
      </label>
      <p style={labelStyle}>Layout</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["left", "center", "right"] as const).map((align) => (
          <button key={align} type="button" onClick={() => patch({ headerAlign: align })} style={{ flex: 1, padding: "8px 4px", border: s.headerAlign === align ? `2px solid ${T.green}` : `1px solid ${T.border}`, borderRadius: radius, background: T.panel, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{align === "left" ? "L" : align === "center" ? "C" : "R"}</button>
        ))}
      </div>
      <select value={s.showEducationBy} onChange={(e) => patch({ showEducationBy: e.target.value as ResumeStyleSettings["showEducationBy"] })} style={{ ...selectStyle, marginBottom: 12 }}>
        <option value="school">Show education by school</option>
        <option value="degree">Show education by degree</option>
      </select>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["inline", "columns", "bullets"] as const).map((layout) => (
          <button key={layout} type="button" onClick={() => patch({ skillsLayout: layout })} style={{ flex: 1, padding: "8px 4px", border: s.skillsLayout === layout ? `2px solid ${T.green}` : `1px solid ${T.border}`, borderRadius: radius, background: T.panel, fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{layout}</button>
        ))}
      </div>
      <p style={labelStyle}>Spacing &amp; margin</p>
      <SliderRow label="Section spacing" value={s.sectionSpacing} onChange={(v) => patch({ sectionSpacing: v })} />
      <SliderRow label="Entry spacing" value={s.entrySpacing} onChange={(v) => patch({ entrySpacing: v })} />
      <SliderRow label="Line spacing" value={s.lineSpacing} onChange={(v) => patch({ lineSpacing: v })} />
      <SliderRow label="Horizontal margin" value={s.marginH} onChange={(v) => patch({ marginH: v })} />
      <SliderRow label="Vertical margin" value={s.marginV} onChange={(v) => patch({ marginV: v })} />
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Justify text</span>
        <input type="checkbox" checked={s.alignText} onChange={(e) => patch({ alignText: e.target.checked })} />
      </label>
    </div>
  );
}
