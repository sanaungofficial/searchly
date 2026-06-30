"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
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

export function FilterBlockTitle({
  title,
  onClear,
  clearDisabled,
}: {
  title: string;
  onClear?: () => void;
  clearDisabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink }}>
        {title}
      </span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled}
          style={{
            border: "none",
            background: "transparent",
            fontFamily: fontSans,
            fontSize: T.label,
            fontWeight: 600,
            color: clearDisabled ? color.mutedLight : color.forest,
            cursor: clearDisabled ? "default" : "pointer",
            opacity: clearDisabled ? 0.5 : 1,
          }}
        >
          Clear All
        </button>
      )}
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: fontSans,
        fontSize: T.label,
        color: color.muted,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: 40,
          height: 22,
          borderRadius: 999,
          background: checked ? color.forest : "rgba(17,17,17,0.18)",
          transition: "background 0.15s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </span>
      {label}
    </label>
  );
}

function splitTagList(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinTagList(items: string[]): string {
  return items.join(", ");
}

/** Jobright-style tag list: checked rows, remove ×, + Add. */
export function TagListField({
  title,
  value,
  onChange,
  placeholder = "Add item",
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const items = splitTagList(value);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const removeItem = (item: string) => {
    onChange(joinTagList(items.filter((i) => i !== item)));
  };

  const addItem = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const next = [...items];
    if (!next.some((i) => i.toLowerCase() === trimmed.toLowerCase())) next.push(trimmed);
    onChange(joinTagList(next));
    setDraft("");
    setAdding(false);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {title ? (
        <FilterBlockTitle
          title={title}
          onClear={() => onChange("")}
          clearDisabled={!items.length}
        />
      ) : null}
      {items.length > 0 && (
        <div
          style={{
            border: border.line,
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          {items.map((item, index) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderTop: index > 0 ? border.line : undefined,
                background: surface.card,
              }}
            >
              <input type="checkbox" checked readOnly style={{ accentColor: color.forest }} />
              <span
                style={{
                  flex: 1,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.ink,
                }}
              >
                {item}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item}`}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: color.muted,
                  display: "flex",
                  padding: 2,
                }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...pipelineInputStyle, margin: 0 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={addItem}
            style={{
              padding: "8px 14px",
              border: border.lineStrong,
              borderRadius: 8,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "12px",
            border: border.line,
            borderRadius: 10,
            background: surface.inset,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.ink,
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          Add
        </button>
      )}
    </div>
  );
}

export function CollapsibleTagListField({
  title,
  value,
  onChange,
  placeholder,
  defaultOpen = false,
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const count = splitTagList(value).length;

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "8px 0",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 700,
          color: color.ink,
        }}
      >
        <span>
          {title}
          {count > 0 ? ` (${count})` : ""}
        </span>
        <ChevronDown
          size={16}
          style={{
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s ease",
            color: color.muted,
          }}
        />
      </button>
      {open && (
        <TagListField title="" value={value} onChange={onChange} placeholder={placeholder} />
      )}
    </div>
  );
}

export function SalarySliderField({
  value,
  openToAll,
  onValueChange,
  onOpenToAllChange,
}: {
  value: string;
  openToAll: boolean;
  onValueChange: (value: string) => void;
  onOpenToAllChange: (open: boolean) => void;
}) {
  const num = value.trim() ? Number(value) : 90000;
  const safeNum = Number.isFinite(num) ? Math.min(Math.max(num, 0), 250000) : 90000;
  const label = openToAll ? "Open to all" : `$${Math.round(safeNum / 1000)}k/yr`;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink }}>
          Minimum Annual Salary{" "}
          <span style={{ fontWeight: 600, color: color.forest }}>{label}</span>
        </span>
        <ToggleSwitch checked={openToAll} onChange={onOpenToAllChange} label="Open to all" />
      </div>
      {!openToAll && (
        <input
          type="range"
          min={0}
          max={250000}
          step={5000}
          value={safeNum}
          onChange={(e) => onValueChange(e.target.value)}
          style={{
            width: "100%",
            accentColor: color.forest,
            cursor: "pointer",
          }}
        />
      )}
    </div>
  );
}

export function RoleTypeToggle({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (value: "IC" | "Manager") => void;
}) {
  const options = [
    { value: "IC" as const, label: "IC" },
    { value: "Manager" as const, label: "Manager" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {options.map(({ value, label }) => {
        const active = selected.has(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 16px",
              border: active ? "2px solid rgba(45, 107, 74, 0.5)" : border.line,
              borderRadius: 10,
              background: active ? "rgba(45, 107, 74, 0.08)" : surface.card,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: active ? 700 : 500,
              color: active ? color.forest : color.ink,
              cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={active} readOnly style={{ accentColor: color.forest }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function CompanyStageGrid({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (stage: string) => void;
}) {
  const stages = [
    { id: "Early", label: "Early Stage" },
    { id: "Growth", label: "Growth Stage" },
    { id: "Late", label: "Late Stage" },
    { id: "Public", label: "Public Company" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {stages.map(({ id, label }) => {
        const active = selected.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              border: active ? "2px solid rgba(45, 107, 74, 0.5)" : border.line,
              borderRadius: 10,
              background: active ? "rgba(45, 107, 74, 0.08)" : surface.card,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: active ? 600 : 500,
              color: color.ink,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <input type="checkbox" checked={active} readOnly style={{ accentColor: color.forest }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AllFiltersSectionAnchor({
  id,
  title,
  hint,
  sectionRef,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  sectionRef?: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-section-id={id}
      ref={sectionRef}
      style={{ scrollMarginTop: 16, marginBottom: 36 }}
    >
      <h3
        style={{
          fontFamily: fontSans,
          fontSize: T.body,
          fontWeight: 700,
          color: color.ink,
          margin: "0 0 4px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          color: color.muted,
          margin: "0 0 20px",
          lineHeight: 1.45,
        }}
      >
        {hint}
      </p>
      {children}
    </section>
  );
}
