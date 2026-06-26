"use client";

import { fontSans, color, surface, border, type as T } from "@/lib/typography";

export const pipelineInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.line,
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.caption,
  boxSizing: "border-box",
  background: surface.card,
};

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 600,
          color: color.muted,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function FilterSectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ gridColumn: "1 / -1", marginBottom: 4 }}>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.forest, margin: "0 0 4px" }}>
        {title}
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: 0, lineHeight: 1.45 }}>
        {hint}
      </p>
    </div>
  );
}

export function DatalistInput({
  value,
  onChange,
  listId,
  options,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  listId: string;
  options: string[];
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <>
      <input
        type={type}
        style={pipelineInputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={options.length ? listId : undefined}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </>
  );
}

export function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        border: active ? border.lineStrong : border.line,
        borderRadius: "var(--scout-radius)",
        background: active ? surface.inset : surface.card,
        color: active ? color.forest : color.muted,
        fontFamily: fontSans,
        fontSize: T.label,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function ProfileSuggestionsBanner({
  labels,
  onApply,
  hint,
}: {
  labels: string[];
  onApply: () => void;
  hint: string;
}) {
  if (!labels.length) return null;
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", background: surface.inset, border: border.line, borderRadius: "var(--scout-radius)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: 0 }}>
          Suggested from profile
        </p>
        <button
          type="button"
          onClick={onApply}
          style={{
            padding: "6px 12px",
            border: border.lineStrong,
            borderRadius: "var(--scout-radius)",
            background: color.forest,
            color: color.gold,
            fontFamily: fontSans,
            fontSize: T.label,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Apply & search
        </button>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "0 0 8px", lineHeight: 1.45 }}>
        {hint}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {labels.map((label) => (
          <span
            key={label}
            style={{
              padding: "3px 8px",
              border: border.line,
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.label,
              color: color.muted,
              background: surface.card,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ActiveFiltersBar({
  labels,
  onClear,
}: {
  labels: string[];
  onClear?: () => void;
}) {
  if (!labels.length) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: surface.inset,
        border: border.line,
        borderRadius: "var(--scout-radius)",
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.forest,
          margin: "0 0 8px",
          letterSpacing: "0.04em",
        }}
      >
        Active filters
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: onClear ? 8 : 0 }}>
        {labels.map((label) => (
          <span
            key={label}
            style={{
              padding: "3px 8px",
              border: border.line,
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.label,
              color: color.ink,
              background: surface.card,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            fontFamily: fontSans,
            fontSize: T.label,
            color: color.muted,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function FilterPanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        background: surface.inset,
        border: border.line,
        borderRadius: "var(--scout-radius)",
      }}
    >
      {children}
    </div>
  );
}
