"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { onboardingAutocompleteListboxStyle } from "@/components/scout/onboarding-autocomplete-shared";
import { color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

export type UserEmailSuggestion = {
  id: string;
  email: string;
  name: string | null;
};

type UserEmailAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  searchUrl: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputStyle?: React.CSSProperties;
  minQueryLength?: number;
  debounceMs?: number;
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

export function UserEmailAutocompleteInput({
  value,
  onChange,
  searchUrl,
  placeholder = "Start typing name or email…",
  required = false,
  disabled = false,
  inputStyle = DEFAULT_INPUT_STYLE,
  minQueryLength = 2,
  debounceMs = 280,
}: UserEmailAutocompleteInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState<UserEmailSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

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
        .then((res) => res.json())
        .then((data: { users?: UserEmailSuggestion[] }) => {
          setSuggestions(data.users ?? []);
          setHighlight(0);
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
  }, [value, searchUrl, minQueryLength, debounceMs]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pickSuggestion = useCallback(
    (suggestion: UserEmailSuggestion) => {
      onChange(suggestion.email);
      setOpen(false);
      setSuggestions([]);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        style={inputStyle}
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
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
          } else if (e.key === "Enter" && showDropdown && suggestions[highlight]) {
            e.preventDefault();
            pickSuggestion(suggestions[highlight]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showDropdown && (
        <ul id={listboxId} role="listbox" style={onboardingAutocompleteListboxStyle}>
          {suggestions.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(item)}
                onMouseEnter={() => setHighlight(index)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  background: index === highlight ? "rgba(26,58,47,0.08)" : "transparent",
                  cursor: "pointer",
                  fontFamily: fontSans,
                }}
              >
                <div style={{ fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                  {item.name ?? item.email}
                </div>
                {item.name && (
                  <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 2 }}>
                    {item.email}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && value.trim().length >= minQueryLength && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>
          Searching…
        </p>
      )}
    </div>
  );
}
