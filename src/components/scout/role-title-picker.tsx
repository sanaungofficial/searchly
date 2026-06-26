"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";

type RoleTitleSuggestion = {
  title: string;
  sampleCount?: number;
};

type RoleTitlePickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addButtonLabel?: string;
  quickSuggestions?: string[];
  /** When true, show "Add similar titles" after picking a seed title. */
  enableRelatedExpand?: boolean;
};

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

export function RoleTitlePicker({
  selected,
  onChange,
  placeholder = "Search job titles…",
  addButtonLabel = "+ Add role",
  quickSuggestions = [],
  enableRelatedExpand = true,
}: RoleTitlePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RoleTitleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandSeed, setExpandSeed] = useState<string | null>(null);
  const [related, setRelated] = useState<RoleTitleSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTitle = useCallback(
    (title: string) => {
      const normalized = normalizeTitle(title);
      if (!normalized || selected.some((r) => r.toLowerCase() === normalized.toLowerCase())) return;
      onChange([...selected, normalized]);
      setOpen(false);
      setQuery("");
      setSuggestions([]);
      setRelated([]);
      setExpandSeed(null);
    },
    [onChange, selected],
  );

  const removeTitle = (title: string) => {
    onChange(selected.filter((r) => r !== title));
  };

  const fetchSuggestions = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/role-titles/search?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json().catch(() => ({}))) as { titles?: RoleTitleSuggestion[] };
      setSuggestions(data.titles ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, fetchSuggestions]);

  const expandRelated = async (seed: string) => {
    const normalized = normalizeTitle(seed);
    if (!normalized) return;
    setExpandSeed(normalized);
    setExpanding(true);
    setRelated([]);
    try {
      const res = await fetch("/api/jobs/role-titles/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: normalized, limit: 12 }),
      });
      const data = (await res.json().catch(() => ({}))) as { titles?: RoleTitleSuggestion[] };
      setRelated(data.titles ?? []);
    } catch {
      setRelated([]);
    } finally {
      setExpanding(false);
    }
  };

  const filteredQuick = quickSuggestions.filter(
    (r) =>
      !selected.some((s) => s.toLowerCase() === r.toLowerCase()) &&
      (!query.trim() || r.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const filteredSuggestions = suggestions.filter(
    (s) => !selected.some((r) => r.toLowerCase() === s.title.toLowerCase()),
  );

  const showCustomAdd =
    query.trim().length >= 2 &&
    !selected.some((r) => r.toLowerCase() === query.trim().toLowerCase()) &&
    !filteredSuggestions.some((s) => s.title.toLowerCase() === query.trim().toLowerCase()) &&
    !filteredQuick.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {selected.map((role) => (
            <span
              key={role}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                border: border.line,
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: T.label,
                color: color.ink,
                background: surface.card,
              }}
            >
              {role}
              {enableRelatedExpand && (
                <button
                  type="button"
                  onClick={() => void expandRelated(role)}
                  title="Find similar titles"
                  style={{
                    border: "none",
                    background: "rgba(26,58,47,0.08)",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: fontSans,
                    fontSize: 11,
                    color: color.forest,
                    padding: "2px 6px",
                  }}
                >
                  + similar
                </button>
              )}
              <button
                type="button"
                onClick={() => removeTitle(role)}
                aria-label={`Remove ${role}`}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: color.muted, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "10px 18px",
            background: "transparent",
            color: "#1A3A2F",
            border: "1px solid rgba(26,58,47,0.2)",
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {addButtonLabel}
        </button>
      ) : (
        <div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: "var(--scout-radius)",
              border: "1.5px solid #1A3A2F",
              fontFamily: fontSans,
              fontSize: isMobile ? 16 : 13,
              color: "#1A1A1A",
              background: "#FFFFFF",
              outline: "none",
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          {loading && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px" }}>
              Searching live job titles…
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {showCustomAdd && (
              <button
                type="button"
                onClick={() => addTitle(query.trim())}
                style={{
                  padding: "6px 14px",
                  background: "#1A3A2F",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans,
                  fontSize: 14,
                  color: "#E8D5A3",
                  cursor: "pointer",
                }}
              >
                + Add &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {filteredSuggestions.slice(0, 16).map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => addTitle(s.title)}
                style={{
                  padding: "6px 14px",
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans,
                  fontSize: 14,
                  color: "#1A1A1A",
                  cursor: "pointer",
                }}
              >
                {s.title}
              </button>
            ))}
            {filteredQuick.slice(0, 12).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => addTitle(r)}
                style={{
                  padding: "6px 14px",
                  background: surface.inset,
                  border: border.line,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans,
                  fontSize: 14,
                  color: color.muted,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
                setSuggestions([]);
                setRelated([]);
                setExpandSeed(null);
              }}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "none",
                fontFamily: fontSans,
                fontSize: 14,
                color: "var(--scout-muted)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          {enableRelatedExpand && query.trim().length >= 2 && (
            <button
              type="button"
              onClick={() => void expandRelated(query.trim())}
              style={{
                marginTop: 10,
                padding: "6px 12px",
                background: "transparent",
                border: "1px dashed rgba(26,58,47,0.25)",
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: 13,
                color: color.forest,
                cursor: "pointer",
              }}
            >
              Find similar titles to &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}

      {expandSeed && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: surface.inset, borderRadius: "var(--scout-radius)", border: border.line }}>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px" }}>
            {expanding ? `Finding titles similar to "${expandSeed}"…` : `Related titles for "${expandSeed}"`}
          </p>
          {!expanding && related.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {related
                .filter((s) => !selected.some((r) => r.toLowerCase() === s.title.toLowerCase()))
                .map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => addTitle(s.title)}
                    style={{
                      padding: "6px 14px",
                      background: "#FFFFFF",
                      border: "1px solid rgba(74,139,106,0.25)",
                      borderRadius: "var(--scout-radius)",
                      fontFamily: fontSans,
                      fontSize: 14,
                      color: color.forest,
                      cursor: "pointer",
                    }}
                  >
                    + {s.title}
                  </button>
                ))}
            </div>
          )}
          {!expanding && related.length === 0 && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
              No related titles found — try a broader seed title.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type JobCategoryPickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  addButtonLabel?: string;
};

export function JobCategoryPicker({
  selected,
  onChange,
  suggestions = [],
  addButtonLabel = "+ Add category",
}: JobCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || categories.length) return;
    setLoading(true);
    void fetch("/api/jobs/categories")
      .then((res) => res.json())
      .then((data: { categories?: string[] }) => setCategories(data.categories ?? []))
      .catch(() => setCategories(suggestions))
      .finally(() => setLoading(false));
  }, [open, categories.length, suggestions]);

  const pool = [...new Set([...categories, ...suggestions])];
  const filtered = pool.filter(
    (cat) =>
      !selected.some((s) => s.toLowerCase() === cat.toLowerCase()) &&
      (!query.trim() || cat.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const addCategory = (cat: string) => {
    const normalized = cat.trim();
    if (!normalized || selected.some((s) => s.toLowerCase() === normalized.toLowerCase())) return;
    onChange([...selected, normalized]);
    setQuery("");
  };

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {selected.map((cat) => (
            <span
              key={cat}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                border: border.line,
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: T.label,
                color: color.muted,
                background: surface.inset,
              }}
            >
              {cat}
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== cat))}
                aria-label={`Remove ${cat}`}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: color.muted, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 14px",
            background: "transparent",
            color: color.forest,
            border: "1px solid rgba(26,58,47,0.15)",
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {addButtonLabel}
        </button>
      ) : (
        <div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter categories…"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "10px 12px",
              borderRadius: "var(--scout-radius)",
              border: border.lineStrong,
              fontFamily: fontSans,
              fontSize: 13,
              marginBottom: 8,
              boxSizing: "border-box",
            }}
          />
          {loading && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px" }}>
              Loading categories…
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {filtered.slice(0, 18).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => addCategory(cat)}
                style={{
                  padding: "5px 12px",
                  background: "#FFFFFF",
                  border: border.line,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
              style={{
                padding: "5px 12px",
                background: "transparent",
                border: "none",
                fontFamily: fontSans,
                fontSize: 13,
                color: color.muted,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
