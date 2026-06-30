"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { FilterBlockTitle, pipelineInputStyle } from "./pipeline-filters-ui";

type IndustryOption = {
  label: string;
  value: string;
  kind: "industry" | "subindustry";
};

function splitList(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(items: string[]): string {
  return items.join(", ");
}

export function IndustrySearchField({
  title,
  value,
  onChange,
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const items = useMemo(() => splitList(value), [value]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<IndustryOption[]>([]);
  const [open, setOpen] = useState(defaultOpen);

  const loadOptions = useCallback((query: string) => {
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    void fetch(`/api/jobs/industries${params}`)
      .then((res) => (res.ok ? res.json() : { options: [] }))
      .then((data: { options?: IndustryOption[] }) => setOptions(data.options ?? []))
      .catch(() => setOptions([]));
  }, []);

  useEffect(() => {
    if (!adding) return;
    const t = window.setTimeout(() => loadOptions(draft), draft.trim() ? 180 : 0);
    return () => window.clearTimeout(t);
  }, [adding, draft, loadOptions]);

  const removeItem = (item: string) => onChange(joinList(items.filter((i) => i !== item)));

  const addItem = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const next = [...items];
    if (!next.some((i) => i.toLowerCase() === trimmed.toLowerCase())) next.push(trimmed);
    onChange(joinList(next));
    setDraft("");
    setAdding(false);
  };

  const body = (
    <>
      {items.length > 0 && (
        <div style={{ border: border.line, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
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
              <span style={{ flex: 1, fontFamily: fontSans, fontSize: T.caption, color: color.ink }}>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item}`}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: color.muted, padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div style={{ position: "relative" }}>
          <input
            style={{ ...pipelineInputStyle, margin: 0 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search industries…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
          />
          {options.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "calc(100% + 4px)",
                zIndex: 20,
                background: surface.card,
                border: border.line,
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {options
                .filter((o) => !items.some((i) => i.toLowerCase() === o.label.toLowerCase()))
                .slice(0, 10)
                .map((opt) => (
                  <button
                    key={`${opt.kind}-${opt.label}`}
                    type="button"
                    onClick={() => addItem(opt.label)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: border.line,
                      background: "transparent",
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      color: color.ink,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                    <span style={{ display: "block", fontSize: T.label, color: color.muted, marginTop: 2 }}>
                      {opt.kind === "subindustry" ? "Sub-industry" : "Industry"}
                    </span>
                  </button>
                ))}
            </div>
          )}
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
    </>
  );

  if (collapsible) {
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
            {items.length > 0 ? ` (${items.length})` : ""}
          </span>
        </button>
        {open && (
          <div>
            <FilterBlockTitle title="" onClear={() => onChange("")} clearDisabled={!items.length} />
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <FilterBlockTitle title={title} onClear={() => onChange("")} clearDisabled={!items.length} />
      {body}
    </div>
  );
}
