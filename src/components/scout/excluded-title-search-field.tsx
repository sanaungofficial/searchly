"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { pipelineInputStyle } from "./pipeline-filters-ui";

function splitList(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(items: string[]): string {
  return items.join(", ");
}

/** Jobright-style excluded title: collapsible + searchable suggestions. */
export function ExcludedTitleSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const items = useMemo(() => splitList(value), [value]);
  const [open, setOpen] = useState(items.length > 0);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetch(`/api/jobs/role-titles/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { titles: [] }))
        .then((data: { titles?: { title: string }[] }) =>
          setSuggestions((data.titles ?? []).map((row) => row.title).slice(0, 10)),
        )
        .catch(() => setSuggestions([]));
    }, 180);
    return () => window.clearTimeout(t);
  }, [draft]);

  const addItem = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const next = [...items];
    if (!next.some((i) => i.toLowerCase() === trimmed.toLowerCase())) next.push(trimmed);
    onChange(joinList(next));
    setDraft("");
  };

  const removeItem = (title: string) => onChange(joinList(items.filter((i) => i !== title)));

  return (
    <div style={{ marginBottom: 16 }}>
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
        <span>Excluded Title{items.length ? ` (${items.length})` : ""}</span>
        <ChevronDown
          size={16}
          style={{ transform: open ? "rotate(180deg)" : undefined, color: color.muted }}
        />
      </button>
      {open && (
        <div>
          {items.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {items.map((item) => (
                <span
                  key={item}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: "rgba(45, 107, 74, 0.14)",
                    border: "1px solid rgba(45, 107, 74, 0.35)",
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    color: color.forest,
                  }}
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    aria-label={`Remove ${item}`}
                    style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: "relative" }}>
            <input
              style={pipelineInputStyle}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search titles to exclude…"
            />
            {draft.trim() && (
              <button
                type="button"
                onClick={() => setDraft("")}
                aria-label="Clear"
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: color.muted,
                }}
              >
                <X size={16} />
              </button>
            )}
            {suggestions.length > 0 && (
              <div
                style={{
                  marginTop: 4,
                  background: surface.card,
                  border: border.line,
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                }}
              >
                {suggestions.map((title) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => addItem(title)}
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
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
