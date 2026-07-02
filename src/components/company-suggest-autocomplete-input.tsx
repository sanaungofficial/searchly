"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CompanyLogo } from "@/components/scout/company-logo";
import { onboardingAutocompleteListboxStyle } from "@/components/scout/onboarding-autocomplete-shared";
import type { CompanySuggestItem } from "@/lib/company-intel";
import { color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type CompanySuggestAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: CompanySuggestItem | null) => void;
  searchUrl?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputStyle?: React.CSSProperties;
  minQueryLength?: number;
  debounceMs?: number;
  showCreateAsNew?: boolean;
};

const DEFAULT_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: surface.card,
  color: color.ink,
};

function formatSuggestionMeta(item: CompanySuggestItem): string {
  const parts: string[] = [];
  if (item.type) parts.push(item.type);
  if (item.source === "hirebase") parts.push("Hirebase");
  else if (item.source === "intel") parts.push("Kimchi intel");
  else if (item.source === "catalog") parts.push("Catalog");
  if (item.website) parts.push(item.website.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  return parts.join(" · ") || "Company";
}

export function CompanySuggestAutocompleteInput({
  value,
  onChange,
  onSelect,
  searchUrl = "/api/companies/suggest",
  placeholder = "Start typing a company name…",
  required = false,
  disabled = false,
  inputStyle = DEFAULT_INPUT_STYLE,
  minQueryLength = 2,
  debounceMs = 220,
  showCreateAsNew = true,
}: CompanySuggestAutocompleteInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState<CompanySuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<CompanySuggestItem | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < minQueryLength) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const url = `${searchUrl}${searchUrl.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}`;
      void fetch(url, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: CompanySuggestItem[]) => {
          const list = Array.isArray(data) ? data : [];
          setSuggestions(list);
          setHighlight(0);
          const keepClosed = picked && picked.name.toLowerCase() === q.toLowerCase();
          setOpen(!keepClosed && (list.length > 0 || showCreateAsNew));
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, searchUrl, minQueryLength, debounceMs, picked, showCreateAsNew]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pickSuggestion = useCallback(
    (item: CompanySuggestItem) => {
      setPicked(item);
      onChange(item.name);
      onSelect(item);
      setOpen(false);
      setSuggestions([]);
      inputRef.current?.focus();
    },
    [onChange, onSelect],
  );

  const createAsNew = useCallback(() => {
    setPicked(null);
    onSelect(null);
    setOpen(false);
    inputRef.current?.focus();
  }, [onSelect]);

  const trimmed = value.trim();
  const exactMatch = suggestions.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());
  const showCreateNewOption = showCreateAsNew && trimmed.length >= minQueryLength && !exactMatch;
  const optionCount = suggestions.length + (showCreateNewOption ? 1 : 0);
  const showDropdown = open && optionCount > 0;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        style={{
          ...inputStyle,
          border: picked ? "1px solid rgba(26,58,47,0.35)" : inputStyle.border,
        }}
        type="text"
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onFocus={() => {
          if (trimmed.length >= minQueryLength && (suggestions.length > 0 || showCreateNewOption)) setOpen(true);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          onSelect(null);
          setPicked(null);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((index) => Math.min(index + 1, Math.max(optionCount - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
          } else if (e.key === "Enter" && showDropdown) {
            if (highlight < suggestions.length && suggestions[highlight]) {
              e.preventDefault();
              pickSuggestion(suggestions[highlight]!);
            } else if (showCreateNewOption && highlight === suggestions.length) {
              e.preventDefault();
              createAsNew();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showDropdown && (
        <ul id={listboxId} role="listbox" style={onboardingAutocompleteListboxStyle}>
          {suggestions.map((item, index) => (
            <li key={`${item.catalogSlug}-${item.id ?? item.source}`} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(item)}
                onMouseEnter={() => setHighlight(index)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  background: index === highlight ? "rgba(26,58,47,0.08)" : "transparent",
                  cursor: "pointer",
                  fontFamily: fontSans,
                }}
              >
                <CompanyLogo
                  name={item.name}
                  website={item.website}
                  careersUrl={item.careersUrl}
                  logoUrl={item.logoUrl}
                  size={24}
                  borderRadius={0}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>{item.name}</div>
                  <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 2 }}>
                    {formatSuggestionMeta(item)}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {showCreateNewOption && (
            <li role="option" aria-selected={highlight === suggestions.length}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={createAsNew}
                onMouseEnter={() => setHighlight(suggestions.length)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  background:
                    highlight === suggestions.length ? "rgba(26,58,47,0.08)" : "transparent",
                  cursor: "pointer",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  color: color.forest,
                  fontWeight: 600,
                }}
              >
                Create &ldquo;{trimmed}&rdquo; as new
              </button>
            </li>
          )}
        </ul>
      )}

      {loading && trimmed.length >= minQueryLength && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>
          Searching Hirebase…
        </p>
      )}
    </div>
  );
}
